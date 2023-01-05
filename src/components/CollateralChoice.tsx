import { useAtomValue } from 'jotai';
import { displayFunctionsAtom } from 'store/app';
import { useVaultStore } from 'store/vaults';
import NewVault from './NewVault';

const CollateralChoice = ({ id }: { id: string }) => {
  const {
    vaultGovernedParams,
    vaultLoadingErrors,
    vaultManagers,
    vaultMetrics,
    prices,
    priceErrors,
  } = useVaultStore();

  const manager = vaultManagers.get(id);
  const metrics = vaultMetrics.get(id);
  const params = vaultGovernedParams.get(id);
  const brand = metrics?.retainedCollateral?.brand;
  const price = brand && prices.get(brand);

  const error = vaultLoadingErrors.get(id) || (brand && priceErrors.get(brand));
  const displayFunctions = useAtomValue(displayFunctionsAtom);
  if (error || !displayFunctions) {
    return (
      <div>
        <>
          <h3>Vault ID: {id}</h3>
          {error && <p>Error: {error.toString()}</p>}
          {!displayFunctions && <p>Error: unable to display asset</p>}
        </>
      </div>
    );
  }

  const isLoading = !(manager && metrics && params && price);
  const {
    displayAmount,
    displayBrandPetname,
    displayPercent,
    displayPrice,
    displayPriceTimestamp,
  } = displayFunctions;

  const content = isLoading ? (
    <div>Loading...</div>
  ) : (
    <>
      <p>Asset price: {displayPrice(price)}</p>
      <p>Last price update: {displayPriceTimestamp(price)}</p>
      <p>
        Debt limit: {displayAmount(params.debtLimit)}{' '}
        {displayBrandPetname(params.debtLimit.brand)}
      </p>
      <p>Interest rate: {displayPercent(params.interestRate, 2)}%</p>
      <p>
        Compounded interest: {displayPercent(manager.compoundedInterest, 2)}%
      </p>
      <p>
        Latest interest update:{' '}
        {new Date(Number(manager.latestInterestUpdate) * 1000).toUTCString()}
      </p>
      <p>Liquidation margin: {displayPercent(params.liquidationMargin, 2)}%</p>
      <p>
        Liquidation penalty: {displayPercent(params.liquidationPenalty, 2)}%
      </p>
      <p>Loan fee: {displayPercent(params.loanFee, 2)}%</p>
      <p>Number of active vaults: {metrics.numActiveVaults}</p>
      <p>Number of liquidating vaults: {metrics.numLiquidatingVaults}</p>
      <p>
        Number of liquidations completed: {metrics.numLiquidationsCompleted}
      </p>
      <p>
        Retained collateral: {displayAmount(metrics.retainedCollateral)}{' '}
        {displayBrandPetname(metrics.retainedCollateral.brand)}
      </p>
      <p>
        Total collateral: {displayAmount(metrics.totalCollateral)}{' '}
        {displayBrandPetname(metrics.totalCollateral.brand)}
      </p>
      <p>
        Total debt: {displayAmount(metrics.totalDebt)}{' '}
        {displayBrandPetname(metrics.totalDebt.brand)}
      </p>
      <p>
        Total overage received: {displayAmount(metrics.totalOverageReceived)}{' '}
        {displayBrandPetname(metrics.totalOverageReceived.brand)}
      </p>
      <p>
        Total proceeds received: {displayAmount(metrics.totalProceedsReceived)}{' '}
        {displayBrandPetname(metrics.totalProceedsReceived.brand)}
      </p>
      <p>
        Total shortfall received:{' '}
        {displayAmount(metrics.totalShortfallReceived)}{' '}
        {displayBrandPetname(metrics.totalShortfallReceived.brand)}
      </p>
      <NewVault id={id} />
    </>
  );

  return (
    <div className="w-fit p-4 pt-2 border border-solid border-black">
      <h3 className="font-semibold mb-1">Vault Manager ID: {id}</h3>
      {content}
    </div>
  );
};

export default CollateralChoice;