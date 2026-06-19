import BeneficiariesScreen from '@/features/beneficiaries/Beneficiaries';
import { EmbedProvider } from '@/exposes/EmbedProvider';

// ---------------------------------------------------------------------------
// FEDERATION ENTRY for `mfe_payments/Beneficiaries`.
//
// The shell lazy-loads this default export:
//     const Beneficiaries = React.lazy(() => import('mfe_payments/Beneficiaries'));
// ---------------------------------------------------------------------------
export default function Beneficiaries() {
  return (
    <EmbedProvider>
      <BeneficiariesScreen />
    </EmbedProvider>
  );
}
