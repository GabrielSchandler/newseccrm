import { describe, expect, it } from "vitest";
import {
  calculateImplicitMonthlyRate,
  calculateInterestRateComparison,
} from "./interest-rate-preview";

describe("interest rate preview", () => {
  it("calculates the implicit monthly rate for fixed installments", () => {
    const monthlyRate = calculateImplicitMonthlyRate(8_000, 48, 200);

    expect(monthlyRate).not.toBeNull();
    expect(monthlyRate! * 100).toBeCloseTo(0.7701, 4);
  });

  it("returns zero when installments only repay the financed amount", () => {
    const comparison = calculateInterestRateComparison({
      financedValue: 12_000,
      installmentCount: 12,
      currentInstallmentValue: 1_000,
      reductionPercentage: 0,
    });

    expect(comparison?.current.totalInterestPercentage).toBe(0);
    expect(comparison?.current.monthlyInterestPercentage).toBe(0);
    expect(comparison?.current.annualInterestPercentage).toBe(0);
  });

  it("identifies negative interest after an excessive reduction", () => {
    const comparison = calculateInterestRateComparison({
      financedValue: 10_000,
      installmentCount: 12,
      currentInstallmentValue: 1_000,
      reductionPercentage: 20,
    });

    expect(comparison?.current.totalInterestPercentage).toBeCloseTo(20, 8);
    expect(comparison?.reduced.installmentValue).toBeCloseTo(800, 8);
    expect(comparison?.reduced.totalInterestPercentage).toBeCloseTo(-4, 8);
    expect(comparison?.reduced.monthlyInterestPercentage).toBeLessThan(0);
    expect(comparison?.reduced.annualInterestPercentage).toBeLessThan(0);
  });

  it("calculates the maximum reduction before total interest becomes negative", () => {
    const comparison = calculateInterestRateComparison({
      financedValue: 10_000,
      installmentCount: 12,
      currentInstallmentValue: 1_000,
      reductionPercentage: 15,
    });

    expect(comparison?.maximumReductionWithoutNegativeInterest).toBeCloseTo(
      16.6667,
      4,
    );
  });

  it("calculates the current and corrected total debt", () => {
    const comparison = calculateInterestRateComparison({
      financedValue: 40_000,
      installmentCount: 48,
      currentInstallmentValue: 1_500,
      reductionPercentage: 10,
    });

    expect(comparison?.current.totalPaid).toBe(72_000);
    expect(comparison?.reduced.totalPaid).toBe(64_800);
  });

  it("does not calculate a comparison with incomplete values", () => {
    expect(
      calculateInterestRateComparison({
        financedValue: 0,
        installmentCount: 12,
        currentInstallmentValue: 1_000,
        reductionPercentage: 30,
      }),
    ).toBeNull();
  });
});
