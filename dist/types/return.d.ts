export interface TaxPayerData {
    PIN: string;
    Name: string;
    StatusPin: string;
    StatusiTax: string;
    ObligationDetails: ObligationDetail[];
}
interface ObligationDetail {
    ObligationName: string;
    CurrentStatus: string;
    EffectiveFromDate: string;
    EffectiveToDate?: string;
}
export {};
