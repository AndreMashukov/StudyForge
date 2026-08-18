import { describe, expect, it } from 'vitest';
import {
  calculateOverageAmountCents,
  DEFAULT_PRICE_PER_CREDIT_CENTS,
  formatCreditUnitPriceFromCents,
  formatCurrencyFromCents,
  roundInvoiceAmountCents,
} from './billing';

describe('billing helpers', () => {
  it('defaults to $0.025 per credit', () => {
    expect(DEFAULT_PRICE_PER_CREDIT_CENTS).toBe(2.5);
    expect(formatCreditUnitPriceFromCents(DEFAULT_PRICE_PER_CREDIT_CENTS)).toBe('$0.025');
  });

  it('computes fractional overage amounts exactly', () => {
    expect(calculateOverageAmountCents(3, 2.5)).toBe(7.5);
    expect(calculateOverageAmountCents(0, 2.5)).toBe(0);
  });

  it('formats totals with two decimal places', () => {
    expect(formatCurrencyFromCents(7.5)).toBe('$0.08');
    expect(formatCurrencyFromCents(125)).toBe('$1.25');
  });

  it('rounds invoice amounts to integer cents', () => {
    expect(roundInvoiceAmountCents(7.5)).toBe(8);
    expect(roundInvoiceAmountCents(7.4)).toBe(7);
    expect(roundInvoiceAmountCents(0.4)).toBe(0);
    expect(roundInvoiceAmountCents(0)).toBe(0);
  });
});
