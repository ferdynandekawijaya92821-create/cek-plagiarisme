// Uji mesin Rekap Keuangan: node rekap-keuangan/test/core.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const RK = require("../../docs/keuangan/core.js");

let n = 0;
const t = (name, fn) => { fn(); n++; };

t("angka format Indonesia & internasional", () => {
  assert.equal(RK.parseAmount("Rp 1.250.000"), 1250000);
  assert.equal(RK.parseAmount("Rp1.250.000,50"), 1250000.5);
  assert.equal(RK.parseAmount("1,250,000.00"), 1250000);
  assert.equal(RK.parseAmount("-50.000"), -50000);
  assert.equal(RK.parseAmount("(75.000)"), -75000);
  assert.equal(RK.parseAmount("150,000.00 DB"), -150000);
  assert.equal(RK.parseAmount("2.500.000,00 CR"), 2500000);
  assert.equal(RK.parseAmount("-Rp 20.000"), -20000);
  assert.equal(RK.parseAmount("12.5"), 12.5);
  assert.equal(RK.parseAmount(-3000), -3000);
  assert.ok(isNaN(RK.parseAmount("abc")));
});

t("tanggal", () => {
  assert.equal(RK.parseDate("03/04/2025"), "2025-04-03");
  assert.equal(RK.parseDate("2025-04-03 10:22:00"), "2025-04-03");
  assert.equal(RK.parseDate("04/23/2025"), "2025-04-23");
  assert.equal(RK.parseDate("12 Agu 2024"), "2024-08-12");
  assert.equal(RK.parseDate("Sabtu, 5 Oktober 2024"), "2024-10-05");
  assert.equal(RK.parseDate("Mar 7, 2025"), "2025-03-07");
  assert.equal(RK.parseDate(45658), "2025-01-01");
  assert.equal(RK.parseDate("31/02/2025"), null);
});

t("CSV titik koma & tanda kutip", () => {
  const rows = RK.parseCSV('﻿Tanggal;Keterangan;Jumlah\n01/02/2025;"Makan; siang";-25.000\n');
  assert.deepEqual(rows, [["Tanggal", "Keterangan", "Jumlah"], ["01/02/2025", "Makan; siang", "-25.000"]]);
});

t("Money Lover (jumlah bertanda)", () => {
  const csv = "ID,Note,Amount,Category,Account,Currency,Date,Event,Exclude Report\n1,Gaji,8000000,Salary,BCA,IDR,01/03/2025,,FALSE\n2,Kopi,-25000,Food & Beverage,Cash,IDR,02/03/2025,,FALSE\n";
  const a = RK.analyzeTable(RK.parseCSV(csv));
  assert.equal(a.app, "Money Lover");
  const { tx } = RK.rowsToTransactions(a.body, a.mapping, "s");
  assert.equal(tx.length, 2);
  assert.deepEqual([tx[0].type, tx[0].amount, tx[0].account, tx[0].date], ["in", 8000000, "BCA", "2025-03-01"]);
  assert.deepEqual([tx[1].type, tx[1].amount, tx[1].category, tx[1].note], ["out", 25000, "Food & Beverage", "Kopi"]);
});

t("Wallet (kolom type)", () => {
  const csv = "account;category;currency;amount;ref_currency_amount;type;payment_type;payment_type_local;note;date\nCash;Groceries;IDR;-150000;-150000;Expenses;CASH;Tunai;Sayur;2025-03-05 08:00:00\nBank;Salary;IDR;5000000;5000000;Income;TRANSFER;Transfer;;2025-03-01 09:00:00\n";
  const a = RK.analyzeTable(RK.parseCSV(csv));
  assert.equal(a.app, "Wallet by BudgetBakers");
  assert.equal(a.headers[a.mapping.amount], "amount");
  const { tx } = RK.rowsToTransactions(a.body, a.mapping, "s");
  assert.deepEqual(tx.map((x) => [x.type, x.amount, x.account]), [["out", 150000, "Cash"], ["in", 5000000, "Bank"]]);
});

t("Buku kas pemasukan/pengeluaran + baris judul di atas", () => {
  const csv = "Laporan Keuangan Maret\n\nNo,Tanggal,Keterangan,Kategori,Pemasukan,Pengeluaran,Saldo\n1,01-03-2025,Gaji,Gaji,\"7.000.000\",,7.000.000\n2,02-03-2025,Listrik,Tagihan,,\"350.000\",6.650.000\n";
  const a = RK.analyzeTable(RK.parseCSV(csv));
  const { tx } = RK.rowsToTransactions(a.body, a.mapping, "s");
  assert.deepEqual(tx.map((x) => [x.date, x.type, x.amount, x.category]), [["2025-03-01", "in", 7000000, "Gaji"], ["2025-03-02", "out", 350000, "Tagihan"]]);
  const s = RK.summarize(tx);
  assert.deepEqual([s.income, s.expense, s.net], [7000000, 350000, 6650000]);
});

t("Mutasi bank dengan CR/DB", () => {
  const csv = "Tanggal Transaksi,Keterangan,Cabang,Jumlah,Saldo\n05/03/2025,TRSF E-BANKING CR,0000,\"1,500,000.00 CR\",\"3,000,000.00\"\n06/03/2025,TARIKAN ATM,0000,\"500,000.00 DB\",\"2,500,000.00\"\n";
  const a = RK.analyzeTable(RK.parseCSV(csv));
  const { tx } = RK.rowsToTransactions(a.body, a.mapping, "s");
  assert.deepEqual(tx.map((x) => [x.type, x.amount]), [["in", 1500000], ["out", 500000]]);
});

t("transfer tidak dihitung sebagai pemasukan/pengeluaran, tapi masuk saldo", () => {
  const tx = [
    { date: "2025-03-01", type: "in", amount: 100, category: "Gaji", account: "A" },
    { date: "2025-03-02", type: "out", amount: 40, category: "Transfer", account: "A", transfer: true },
    { date: "2025-03-02", type: "in", amount: 40, category: "Transfer", account: "B", transfer: true },
  ];
  const s = RK.summarize(tx);
  assert.deepEqual([s.income, s.expense], [100, 0]);
  assert.deepEqual(RK.balances(tx, { A: 10 }), { A: 70, B: 40 });
});

t("ID stabil untuk impor ulang, baris kembar tetap dua", () => {
  const rows = [["01/03/2025", "-5000", "Parkir"], ["01/03/2025", "-5000", "Parkir"]];
  const m = { date: 0, amount: 1, note: 2 };
  const a = RK.rowsToTransactions(rows, m, "s").tx, b = RK.rowsToTransactions(rows, m, "s").tx;
  assert.equal(a.length, 2);
  assert.notEqual(a[0].id, a[1].id);
  assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
});

t("tautan Google Sheets", () => {
  assert.equal(RK.normalizeSheetUrl("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=42"),
    "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/gviz/tq?tqx=out:csv&gid=42");
  assert.equal(RK.normalizeSheetUrl("https://docs.google.com/spreadsheets/d/e/2PACX-abc/pubhtml"),
    "https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?output=csv");
});

t("JSON", () => {
  const rows = RK.jsonToRows({ transactions: [{ date: "2025-01-02", amount: -1000, note: "x" }] });
  assert.deepEqual(rows, [["date", "amount", "note"], ["2025-01-02", -1000, "x"]]);
});

console.log(`✓ ${n} kelompok uji lolos`);
