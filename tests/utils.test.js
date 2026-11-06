import test from 'node:test';
import assert from 'node:assert/strict';
import { dateLabel, dateRange, money, safeNext } from '../src/lib/utils.js';

test('dateLabel accepte year booléen et chaîne',()=>{const v='2027-03-15T20:00:00Z';assert.match(dateLabel(v,{year:true}),/2027/);assert.match(dateLabel(v,{year:'numeric'}),/2027/);assert.doesNotMatch(dateLabel(v,{year:false}),/2027/);assert.doesNotMatch(dateLabel(v),/2027/);});
test('dateRange ne plante pas avec year true/false',()=>{const a='2027-03-15T20:00:00Z',b='2027-03-17T08:00:00Z';assert.ok(dateRange(a,b,{year:true}).includes('2027'));assert.ok(!dateRange(a,b,{year:false}).includes('2027'));});
test('money en FCFA et safeNext interne',()=>{assert.match(money(52500),/52.?500 FCFA/);assert.equal(safeNext('/mes-sejours'),'/mes-sejours');assert.equal(safeNext('https://evil.test'),'/');assert.equal(safeNext('//evil.test'),'/');});
