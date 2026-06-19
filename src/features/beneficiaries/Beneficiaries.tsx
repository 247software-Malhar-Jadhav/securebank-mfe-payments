import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Plus, Users } from 'lucide-react';

import {
  useGetBeneficiariesQuery,
  useAddBeneficiaryMutation,
} from '@/store/api';
import { describeError } from '@/lib/errors';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
// Beneficiaries screen. Lists saved payees (GET /api/beneficiaries) and lets
// the user add one through a dialog (POST /api/beneficiaries) with localized
// zod validation. States: loading skeleton / error+retry / empty / list.
// ---------------------------------------------------------------------------

function useBeneficiarySchema() {
  const { t } = useTranslation();
  return useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('validation.nameRequired')),
        accountNumber: z
          .string()
          .min(1, t('validation.accountRequired'))
          .regex(/^\d{6,18}$/, t('validation.accountDigits')),
        // IFSC: 4 letters, a 0, then 6 alphanumerics. Optional.
        ifsc: z
          .string()
          .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, t('validation.ifscFormat'))
          .optional()
          .or(z.literal('')),
        nickname: z.string().max(40).optional(),
      }),
    [t],
  );
}

type BeneficiaryFormValues = {
  name: string;
  accountNumber: string;
  ifsc?: string;
  nickname?: string;
};

export default function Beneficiaries() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const listQuery = useGetBeneficiariesQuery();
  const [addBeneficiary, addState] = useAddBeneficiaryMutation();

  const schema = useBeneficiarySchema();
  const form = useForm<BeneficiaryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', accountNumber: '', ifsc: '', nickname: '' },
  });

  async function onSubmit(values: BeneficiaryFormValues) {
    try {
      const created = await addBeneficiary({
        name: values.name,
        accountNumber: values.accountNumber,
        ifsc: values.ifsc || undefined,
        nickname: values.nickname || undefined,
      }).unwrap();
      toast({
        variant: 'success',
        title: t('beneficiaries.toast.addedTitle'),
        description: t('beneficiaries.toast.addedBody', { name: created.name }),
      });
      form.reset();
      setOpen(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('beneficiaries.toast.errorTitle'),
        description: describeError(err as never, t),
      });
    }
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-5 w-5" />
            {t('beneficiaries.title')}
          </CardTitle>
          <CardDescription>{t('beneficiaries.subtitle')}</CardDescription>
        </div>

        {/* ADD DIALOG */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('beneficiaries.add')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('beneficiaries.dialog.title')}</DialogTitle>
              <DialogDescription>{t('beneficiaries.dialog.description')}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('beneficiaries.dialog.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('beneficiaries.dialog.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('beneficiaries.dialog.accountNumber')}</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          placeholder={t('beneficiaries.dialog.accountNumberPlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ifsc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('beneficiaries.dialog.ifsc')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('beneficiaries.dialog.ifscPlaceholder')}
                          // Normalise to upper case so the IFSC regex matches.
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('beneficiaries.dialog.nickname')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('beneficiaries.dialog.nicknamePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    {t('beneficiaries.dialog.cancel')}
                  </Button>
                  <Button type="submit" disabled={addState.isLoading}>
                    {addState.isLoading
                      ? t('beneficiaries.dialog.saving')
                      : t('beneficiaries.dialog.save')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {/* LOADING */}
        {listQuery.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {/* ERROR */}
        {listQuery.isError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{t('common.loadingError')}</p>
            <Button variant="outline" onClick={() => void listQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* EMPTY */}
        {listQuery.isSuccess && listQuery.data.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('beneficiaries.empty')}
          </p>
        )}

        {/* LIST */}
        {listQuery.isSuccess && listQuery.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t('beneficiaries.table.name')}</th>
                  <th className="py-2 pr-4 font-medium">{t('beneficiaries.table.account')}</th>
                  <th className="py-2 pr-4 font-medium">{t('beneficiaries.table.ifsc')}</th>
                  <th className="py-2 font-medium">{t('beneficiaries.table.nickname')}</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{b.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{b.accountNumber}</td>
                    <td className="py-2 pr-4">{b.ifsc ?? '—'}</td>
                    <td className="py-2">{b.nickname ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
