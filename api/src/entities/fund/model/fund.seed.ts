import type { Loc } from './types';

export interface FundSeed {
  jarUrl: string;
  card: string;
  regions: Loc[];
  categories: Array<{ name: Loc; color: string }>;
}


export const FUND_SEED: FundSeed = {
  jarUrl: "https://send.monobank.ua/jar/8wj2DmvhZw",
  card: "4441 1111 2710 9621",

  regions: [
    { uk: "Київська", en: "Kyiv" },
    { uk: "Сумська", en: "Sumy" },
    { uk: "Харківська", en: "Kharkiv" },
    { uk: "Донецька", en: "Donetsk" },
    { uk: "Дніпропетровська", en: "Dnipropetrovsk" },
    { uk: "Запорізька", en: "Zaporizhzhia" },
    { uk: "Житомирська", en: "Zhytomyr" },
    { uk: "Львівська", en: "Lviv" },
  ],

  categories: [
    { name: { uk: "Авто", en: "Vehicles" }, color: "#4C5A3E" },
    { name: { uk: "Техніка та аксесуари", en: "Electronics & gear" }, color: "#B5762F" },
    { name: { uk: "Військові речі", en: "Military kit" }, color: "#7C8A68" },
    { name: { uk: "Інше", en: "Other" }, color: "#B9BEB6" },
  ],
};
