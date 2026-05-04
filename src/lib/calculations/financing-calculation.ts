import type { FinancingCalculationComputedValues } from "@/types/calculation";
import { parseBrazilianDecimalInput } from "@/lib/calculations/currency";

export const DEFAULT_INSTALLMENT_ADJUSTMENT_FACTOR = 0.7;

type CalculationInput = {
  cash_value?: number | string | null;
  down_payment?: number | string | null;
  financed_value?: number | string | null;
  installment_count?: number | string | null;
  current_installment_value?: number | string | null;
  paid_installments?: number | string | null;
  remaining_installments?: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = parseBrazilianDecimalInput(value);

  if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function calculateFinancingRevision(
  input: CalculationInput,
): FinancingCalculationComputedValues {
  const installmentCount = toNumber(input.installment_count);
  const currentInstallmentValue = toNumber(input.current_installment_value);
  const paidInstallments = toNumber(input.paid_installments);
  const remainingInstallments = toNumber(input.remaining_installments);

  const correctedInstallmentValue =
    currentInstallmentValue * DEFAULT_INSTALLMENT_ADJUSTMENT_FACTOR;
  const currentTotalFinancing = currentInstallmentValue * installmentCount;
  const correctedTotalFinancing = correctedInstallmentValue * installmentCount;
  const abusiveInterestPerInstallment =
    currentInstallmentValue - correctedInstallmentValue;
  const paidAmountUntilNow = currentInstallmentValue * paidInstallments;
  const abusiveInterestPaid = abusiveInterestPerInstallment * paidInstallments;
  const remainingAmountToPay = remainingInstallments * currentInstallmentValue;
  const realDebt = correctedTotalFinancing - paidAmountUntilNow;
  const estimatedSavings = currentTotalFinancing - correctedTotalFinancing;
  const installmentReductionRemaining =
    remainingInstallments > 0 ? realDebt / remainingInstallments : 0;
  const discount30Value = remainingAmountToPay * 0.3;
  const discount90Value = remainingAmountToPay * 0.9;
  const debtAfter30Discount = remainingAmountToPay - discount30Value;
  const debtAfter90Discount = remainingAmountToPay - discount90Value;
  const halfDiscountBase = remainingAmountToPay * 0.5;

  return {
    corrected_installment_value: roundCurrency(correctedInstallmentValue),
    current_total_financing: roundCurrency(currentTotalFinancing),
    corrected_total_financing: roundCurrency(correctedTotalFinancing),
    abusive_interest_per_installment: roundCurrency(
      abusiveInterestPerInstallment,
    ),
    paid_amount_until_now: roundCurrency(paidAmountUntilNow),
    abusive_interest_paid: roundCurrency(abusiveInterestPaid),
    remaining_amount_to_pay: roundCurrency(remainingAmountToPay),
    real_debt: roundCurrency(realDebt),
    estimated_savings: roundCurrency(estimatedSavings),
    installment_reduction_remaining: roundCurrency(
      installmentReductionRemaining,
    ),
    discount_30_value: roundCurrency(discount30Value),
    discount_90_value: roundCurrency(discount90Value),
    debt_after_30_discount: roundCurrency(debtAfter30Discount),
    debt_after_90_discount: roundCurrency(debtAfter90Discount),
    example_50_discount_15x: roundCurrency(halfDiscountBase / 15),
    example_50_discount_10x: roundCurrency(halfDiscountBase / 10),
    example_50_discount_5x: roundCurrency(halfDiscountBase / 5),
  };
}
