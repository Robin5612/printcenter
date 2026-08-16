export type CompletedSupplierTier = {
  quantity: number;
  unitPrice: number;
  supplierTotal: number;
};

export function completeSupplierTier(quantity: number, unitValue: string | number, totalValue: string | number): CompletedSupplierTier {
  let unitPrice = Number(unitValue);
  let supplierTotal = Number(totalValue);
  if (!(quantity > 0)) throw new Error("Die Staffelmenge muss grösser als null sein.");
  if (!(unitPrice > 0) && !(supplierTotal > 0)) throw new Error(`Bitte für ${quantity} Stück mindestens Einzelpreis oder Gesamtpreis eintragen.`);
  if (unitPrice > 0 && !(supplierTotal > 0)) supplierTotal = unitPrice * quantity;
  else if (supplierTotal > 0 && !(unitPrice > 0)) unitPrice = supplierTotal / quantity;
  else if (Math.abs(unitPrice * quantity - supplierTotal) > 0.02) throw new Error(`Einzel- und Gesamtpreis für ${quantity} Stück stimmen nicht überein. Bitte einen Wert leeren oder korrigieren.`);
  return { quantity, unitPrice: Number(unitPrice.toFixed(6)), supplierTotal: Number(supplierTotal.toFixed(2)) };
}

export function customerTierPrices(option: CompletedSupplierTier, markupPercent: number) {
  const total = option.supplierTotal * (1 + markupPercent / 100);
  return { total, unitPrice: total / option.quantity };
}
