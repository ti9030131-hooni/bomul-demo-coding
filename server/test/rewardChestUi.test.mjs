import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const uiPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/public/ar/js/rewardChestUi.js',
);

function loadUi() {
  const code = readFileSync(uiPath, 'utf8');
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox.BomulRewardChestUi;
}

test('서버 보상 성공(server)일 때만 congrats 제목', () => {
  const { rewardTitleKind } = loadUi();
  assert.equal(rewardTitleKind({ server: true, earned: 500 }), 'congrats');
  assert.equal(rewardTitleKind({ blocked: 'onsite' }), 'needOnsite');
  assert.equal(rewardTitleKind({ blocked: 'login' }), 'login');
  assert.equal(rewardTitleKind(null), 'needOnsite');
  assert.equal(rewardTitleKind({}), 'needOnsite');
});

test('데모 완주(로컬 onsite 미완료)와 서버 거절을 부제로 구분', () => {
  const { rewardSubKind } = loadUi();
  assert.equal(rewardSubKind({ server: true }, true), 'congrats');
  assert.equal(rewardSubKind({ blocked: 'onsite' }, false), 'demoNeedOnsite');
  assert.equal(rewardSubKind({ blocked: 'onsite' }, true), 'needOnsite');
  assert.equal(rewardSubKind({ blocked: 'login' }, false), 'login');
});

test('현장 인증 안내는 제목+부제 한 세트로만 쓰고 congrats는 server일 때만', () => {
  const { rewardTitleKind, rewardSubKind } = loadUi();
  const reward = { blocked: 'onsite' };
  assert.equal(rewardTitleKind(reward), 'needOnsite');
  assert.equal(rewardSubKind(reward, false), 'demoNeedOnsite');
  assert.notEqual(rewardTitleKind(reward), 'congrats');
  assert.equal(rewardTitleKind({ server: true }), 'congrats');
});

test('수령 완료 hint는 서버 보상 성공일 때만, 데모·현장 미완료는 demoOpened', () => {
  const { rewardHintKind } = loadUi();
  assert.equal(rewardHintKind(null, false), 'hint');
  assert.equal(rewardHintKind({ blocked: 'onsite' }, true), 'demoOpened');
  assert.equal(rewardHintKind({ blocked: 'login' }, true), 'needLogin');
  assert.equal(rewardHintKind({ server: true, earned: 500 }, true), 'openedHint');
  assert.notEqual(rewardHintKind({ blocked: 'onsite' }, true), 'openedHint');
});

test('적립금 표시는 서버 지급 성공일 때만 paid, 그 외는 demoUnpaid', () => {
  const { rewardPointsStatus, expectedPrizePoints } = loadUi();
  assert.equal(rewardPointsStatus({ server: true, earned: 500 }), 'paid');
  assert.equal(rewardPointsStatus({ blocked: 'onsite', earned: 0 }), 'demoUnpaid');
  assert.equal(rewardPointsStatus(null), 'demoUnpaid');
  assert.equal(expectedPrizePoints([{ points: 500 }, { icon: 'cert' }]), 500);
});
