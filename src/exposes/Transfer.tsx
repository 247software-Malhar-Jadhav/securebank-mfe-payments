import TransferScreen from '@/features/transfer/Transfer';
import { EmbedProvider } from '@/exposes/EmbedProvider';

// ---------------------------------------------------------------------------
// FEDERATION ENTRY for `mfe_payments/Transfer`.
//
// The shell lazy-loads this default export:
//     const Transfer = React.lazy(() => import('mfe_payments/Transfer'));
//
// We wrap the screen in <EmbedProvider> so it has a Redux store + Toaster +
// i18n bundles whether it is embedded under the shell or mounted bare. The
// inner screen is provider-agnostic.
// ---------------------------------------------------------------------------
export default function Transfer() {
  return (
    <EmbedProvider>
      <TransferScreen />
    </EmbedProvider>
  );
}
