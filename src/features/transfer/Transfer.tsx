import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Send } from 'lucide-react';

import {
  useGetAccountsQuery,
  useGetBeneficiariesQuery,
  useTransferMutation,
} from '@/store/api';
import { formatMoney, localeForLanguage } from '@/lib/utils';
import { describeTransferError } from '@/lib/errors';
import type { Account, TransferResponse } from '@/types/api';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';

// ---------------------------------------------------------------------------
// Transfer screen. A money-movement form:
//   from account (select)  +  to beneficiary (select)  +  amount  +  description
// On submit: POST /api/transactions/transfer. We render three states:
//   - loading skeleton while accounts/beneficiaries load
//   - the form (with localized zod validation)
//   - a success panel showing the returned reference + new balance
// Business errors (FRAUD_BLOCK, INSUFFICIENT_FUNDS) and RFC-7807 problems are
// surfaced via a localized toast.
// ---------------------------------------------------------------------------

/**
 * Build the zod schema. It is created INSIDE the component (memoized on
 * language + the selected source account) so validation messages are localized
 * and the max-amount rule can reference the chosen account's live balance.
 */
function useTransferSchema(maxBalance: number | undefined) {
  const { t } = useTranslation();
  return useMemo(
    () =>
      z.object({
        fromAccountId: z.string().min(1, t('validation.fromRequired')),
        toAccountId: z.string().min(1, t('validation.toRequired')),
        amount: z
          .coerce.number({ invalid_type_error: t('validation.amountNumber') })
          .positive(t('validation.amountPositive'))
          .refine(
            (v) => maxBalance === undefined || v <= maxBalance,
            { message: t('validation.amountMax') },
          ),
        description: z.string().max(140).optional(),
      }),
    [t, maxBalance],
  );
}

type TransferFormValues = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
};

export default function Transfer() {
  const { t, i18n } = useTranslation();
  const locale = localeForLanguage(i18n.language);
  const { toast } = useToast();

  // Data loads.
  const accountsQuery = useGetAccountsQuery();
  const beneficiariesQuery = useGetBeneficiariesQuery();
  const [transfer, transferState] = useTransferMutation();

  // The reference + balance returned by a COMPLETED transfer (success panel).
  const [result, setResult] = useState<TransferResponse | null>(null);

  // Track the selected source account so we can show its balance and cap the
  // amount. We read it back out of the form below.
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const selectedAccount: Account | undefined = accountsQuery.data?.find(
    (a) => a.id === fromAccountId,
  );

  const schema = useTransferSchema(selectedAccount?.balance);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: 0, description: '' },
    mode: 'onBlur',
  });

  async function onSubmit(values: TransferFormValues) {
    // Currency follows the source account (a transfer is denominated in the
    // funding account's currency).
    const currency = selectedAccount?.currency ?? 'INR';
    try {
      const res = await transfer({
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
        amount: values.amount,
        currency,
        description: values.description,
      }).unwrap();
      // 201 COMPLETED -> show success.
      setResult(res);
      form.reset();
      setFromAccountId('');
    } catch (err) {
      // 422 REJECTED (FRAUD_BLOCK / INSUFFICIENT_FUNDS) / 502 FAILED / 4xx
      // problem -> localized toast.
      const { title, body } = describeTransferError(err as never, t);
      toast({ variant: 'destructive', title, description: body });
    }
  }

  // ----- LOADING -----------------------------------------------------------
  if (accountsQuery.isLoading || beneficiariesQuery.isLoading) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  // ----- DATA-LOAD ERROR ---------------------------------------------------
  if (accountsQuery.isError || beneficiariesQuery.isError) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-destructive">{t('common.loadingError')}</p>
          <Button
            variant="outline"
            onClick={() => {
              void accountsQuery.refetch();
              void beneficiariesQuery.refetch();
            }}
          >
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const accounts = accountsQuery.data ?? [];
  const beneficiaries = beneficiariesQuery.data ?? [];

  // ----- SUCCESS -----------------------------------------------------------
  if (result && result.status === 'COMPLETED') {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <CardTitle className="text-xl">{t('transfer.success.title')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            {t('transfer.success.reference', { reference: result.reference })}
          </p>
          {result.sourceBalanceAfter !== null && (
            <p className="text-sm">
              {t('transfer.success.newBalance', {
                balance: formatMoney(
                  result.sourceBalanceAfter,
                  selectedAccount?.currency ?? 'INR',
                  locale,
                ),
              })}
            </p>
          )}
          <Button className="mt-4" onClick={() => setResult(null)}>
            {t('transfer.success.another')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ----- FORM --------------------------------------------------------------
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="text-xl">{t('transfer.title')}</CardTitle>
        <CardDescription>{t('transfer.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* FROM ACCOUNT */}
            <FormField
              control={form.control}
              name="fromAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transfer.fromAccount')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      setFromAccountId(v);
                      // Re-validate amount against the new balance cap.
                      void form.trigger('amount');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('transfer.fromAccountPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {t('transfer.noAccounts')}
                        </div>
                      ) : (
                        accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.accountNumber} · {formatMoney(a.balance, a.currency, locale)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedAccount && (
                    <p className="text-xs text-muted-foreground">
                      {t('transfer.available', {
                        balance: formatMoney(
                          selectedAccount.balance,
                          selectedAccount.currency,
                          locale,
                        ),
                      })}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* TO BENEFICIARY */}
            <FormField
              control={form.control}
              name="toAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transfer.toBeneficiary')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('transfer.toBeneficiaryPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {beneficiaries.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {t('transfer.noBeneficiaries')}
                        </div>
                      ) : (
                        beneficiaries.map((b) => (
                          <SelectItem key={b.id} value={b.accountNumber}>
                            {b.nickname ? `${b.nickname} — ` : ''}
                            {b.name} · {b.accountNumber}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AMOUNT */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transfer.amount')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder={t('transfer.amountPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* DESCRIPTION */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transfer.description')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('transfer.descriptionPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={transferState.isLoading} className="gap-2">
              {transferState.isLoading ? (
                t('transfer.submitting')
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('transfer.submit')}
                </>
              )}
            </Button>

            {/* When the source account is FROZEN we still let the backend be the
                authority, but a small badge hints at status. */}
            {selectedAccount && selectedAccount.status !== 'ACTIVE' && (
              <Badge variant="destructive" className="ml-2">
                {selectedAccount.status}
              </Badge>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
