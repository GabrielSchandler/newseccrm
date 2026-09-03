const RATE_PRECISION = 1e-10;
const MAX_BISECTION_ITERATIONS = 160;

export type InterestRateScenario = {
  installmentValue: number;
  totalPaid: number;
  totalInterestValue: number;
  totalInterestPercentage: number;
  monthlyInterestPercentage: number | null;
  annualInterestPercentage: number | null;
};

export type InterestRateComparison = {
  financedValue: number;
  installmentCount: number;
  reductionPercentage: number;
  maximumReductionWithoutNegativeInterest: number;
  current: InterestRateScenario;
  reduced: InterestRateScenario;
};

type InterestRateComparisonInput = {
  financedValue: number;
  installmentCount: number;
  currentInstallmentValue: number;
  reductionPercentage: number;
};

function installmentForMonthlyRate(
  financedValue: number,
  installmentCount: number,
  monthlyRate: number,
) {
  if (Math.abs(monthlyRate) < RATE_PRECISION) {
    return financedValue / installmentCount;
  }

  const discountFactor = Math.pow(1 + monthlyRate, -installmentCount);

  if (!Number.isFinite(discountFactor)) {
    return 0;
  }

  return (financedValue * monthlyRate) / (1 - discountFactor);
}

export function calculateImplicitMonthlyRate(
  financedValue: number,
  installmentCount: number,
  installmentValue: number,
) {
  if (
    !Number.isFinite(financedValue) ||
    financedValue <= 0 ||
    !Number.isInteger(installmentCount) ||
    installmentCount <= 0 ||
    !Number.isFinite(installmentValue) ||
    installmentValue <= 0
  ) {
    return null;
  }

  const zeroRateInstallment = financedValue / installmentCount;

  if (Math.abs(installmentValue - zeroRateInstallment) < RATE_PRECISION) {
    return 0;
  }

  let lowerRate = -0.999999999;
  let upperRate = 1;

  while (
    installmentForMonthlyRate(financedValue, installmentCount, upperRate) <
      installmentValue &&
    upperRate < 1_000_000
  ) {
    upperRate *= 2;
  }

  if (
    installmentForMonthlyRate(financedValue, installmentCount, upperRate) <
    installmentValue
  ) {
    return null;
  }

  for (let iteration = 0; iteration < MAX_BISECTION_ITERATIONS; iteration += 1) {
    const middleRate = (lowerRate + upperRate) / 2;
    const middleInstallment = installmentForMonthlyRate(
      financedValue,
      installmentCount,
      middleRate,
    );

    if (middleInstallment < installmentValue) {
      lowerRate = middleRate;
    } else {
      upperRate = middleRate;
    }
  }

  return (lowerRate + upperRate) / 2;
}

function calculateScenario(
  financedValue: number,
  installmentCount: number,
  installmentValue: number,
): InterestRateScenario {
  const totalPaid = installmentValue * installmentCount;
  const totalInterestValue = totalPaid - financedValue;
  const totalInterestPercentage = (totalInterestValue / financedValue) * 100;
  const monthlyRate = calculateImplicitMonthlyRate(
    financedValue,
    installmentCount,
    installmentValue,
  );

  return {
    installmentValue,
    totalPaid,
    totalInterestValue,
    totalInterestPercentage,
    monthlyInterestPercentage:
      monthlyRate === null ? null : monthlyRate * 100,
    annualInterestPercentage:
      monthlyRate === null ? null : (Math.pow(1 + monthlyRate, 12) - 1) * 100,
  };
}

export function calculateInterestRateComparison({
  financedValue,
  installmentCount,
  currentInstallmentValue,
  reductionPercentage,
}: InterestRateComparisonInput): InterestRateComparison | null {
  if (
    !Number.isFinite(financedValue) ||
    financedValue <= 0 ||
    !Number.isInteger(installmentCount) ||
    installmentCount <= 0 ||
    !Number.isFinite(currentInstallmentValue) ||
    currentInstallmentValue <= 0 ||
    !Number.isFinite(reductionPercentage)
  ) {
    return null;
  }

  const normalizedReductionPercentage = Math.min(
    Math.max(reductionPercentage, 0),
    100,
  );
  const reducedInstallmentValue =
    currentInstallmentValue * (1 - normalizedReductionPercentage / 100);
  const currentTotalPaid = currentInstallmentValue * installmentCount;
  const maximumReductionWithoutNegativeInterest = Math.min(
    Math.max((1 - financedValue / currentTotalPaid) * 100, 0),
    100,
  );

  return {
    financedValue,
    installmentCount,
    reductionPercentage: normalizedReductionPercentage,
    maximumReductionWithoutNegativeInterest,
    current: calculateScenario(
      financedValue,
      installmentCount,
      currentInstallmentValue,
    ),
    reduced: calculateScenario(
      financedValue,
      installmentCount,
      reducedInstallmentValue,
    ),
  };
}
