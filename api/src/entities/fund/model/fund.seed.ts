import type { PublicFund } from './types';

export const FUND_SEED: PublicFund = {
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
    { name: { uk: "Авто", en: "Vehicles" }, amount: 276880, color: "#4C5A3E" },
    { name: { uk: "Техніка та аксесуари", en: "Electronics & gear" }, amount: 48438, color: "#B5762F" },
    { name: { uk: "Військові речі", en: "Military kit" }, amount: 36473, color: "#7C8A68" },
    { name: { uk: "Інше", en: "Other" }, amount: 2691, color: "#B9BEB6" },
  ],

  years: [
    { year: "2025", amount: 82836.73 },
    { year: "2026", amount: 281646.25 },
  ],

  months: [
    [1, 32214],
    [2, 41949.25],
    [3, 63000],
    [4, 30400],
    [5, 43050],
    [6, 33070],
    [7, 9998],
    [8, 25000],
    [9, 2965],
  ],

  recent: [
    { date: "2026-09-05", title: { uk: "Ремонт авто — деталь зчеплення", en: "Car repair — clutch part" }, amount: 2500 },
    { date: "2026-09-02", title: { uk: "Підтримка платформи", en: "Platform upkeep" }, amount: 465 },
    { date: "2026-08-05", title: { uk: "Ремонт авто", en: "Car repair" }, amount: 25000 },
    { date: "2026-07-28", title: { uk: "Спальні мішки", en: "Sleeping bags" }, amount: 9998 },
    { date: "2026-06-15", title: { uk: "Збір на авто", en: "Fundraiser for a car" }, amount: 20000 },
    { date: "2026-06-03", title: { uk: "Ремонт авто", en: "Car repair" }, amount: 13070 },
    { date: "2026-05-06", title: { uk: "Придбання буса", en: "Buying a van" }, amount: 43050 },
    { date: "2026-04-22", title: { uk: "Ноутбук для військового", en: "Laptop for a serviceman" }, amount: 30400 },
    { date: "2026-03-21", title: { uk: "Допомога з купівлею авто", en: "Help buying a car" }, amount: 40000 },
    { date: "2026-03-12", title: { uk: "Збір на муфту", en: "Fundraiser for a coupling" }, amount: 23000 },
  ],
};
