import { useEffect, useMemo, useState } from 'react';
import ProfileHud from '../components/ProfileHud.jsx';

const asset = '/assets/liars-dice/daily-reward/';

function TopProfile({ navigation, user, tx }) {
  return <ProfileHud className="daily-reward-profile" user={user} onClick={navigation.goProfile} ariaLabel={tx('Open Profile')} />;
}

function Currency({ type, icon, value }) {
  return (
    <div className={`daily-reward-currency daily-reward-currency--${type}`}>
      <img className="daily-reward-currency__icon" src={`${asset}${icon}`} alt="" draggable="false" />
      <span className="daily-reward-currency__value">{value}</span>
      <img className="daily-reward-currency__plus" src={`${asset}8.png`} alt="" draggable="false" />
    </div>
  );
}

function formatAmount(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return String(value || '0');
  return new Intl.NumberFormat('en-US').format(number);
}

function formatTransactionType(type = '') {
  return String(type)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimeRemaining(target, now) {
  if (!target) return '';
  const targetTime = new Date(target).getTime();
  if (!Number.isFinite(targetTime)) return '';

  const remainingMs = targetTime - now;
  if (remainingMs <= 0) return 'Ready now';

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function RewardCard({ reward, onClaim, tx, disabled, isClaiming }) {
  const isClaimable = reward.state === 'claimable';
  const buttonText = isClaiming && isClaimable ? 'Claiming...' : reward.status;

  return (
    <article className={`daily-reward-card daily-reward-card--${reward.key} daily-reward-card--${reward.state}`}>
      <img className="daily-reward-card__skin" src={`${asset}${reward.card}`} alt="" draggable="false" />
      <button
        className="daily-reward-card__button"
        type="button"
        disabled={disabled || !isClaimable}
        onClick={() => (isClaimable && !disabled ? onClaim?.(reward) : null)}
      >
        <span>{tx(buttonText)}</span>
      </button>
    </article>
  );
}

function DailyRewardStatus({ summary, hasClaimable, now, tx }) {
  const claimedToday = Boolean(summary?.claimedToday);
  const nextRewardAt = summary?.nextRewardAt;
  const timer = getTimeRemaining(nextRewardAt, now);

  let copy = hasClaimable ? 'Reward ready to claim' : 'Complete today’s claim to continue your streak';
  if (claimedToday) copy = nextRewardAt ? `Next reward in ${timer}` : 'Daily reward already claimed today';

  return (
    <div className="daily-reward-status" aria-live="polite">
      <span className="daily-reward-status__title">{tx(claimedToday ? 'CLAIMED TODAY' : hasClaimable ? 'READY' : 'DAILY STREAK')}</span>
      <span className="daily-reward-status__copy">{tx(copy)}</span>
      <span className="daily-reward-status__streak">{tx('STREAK')}: {summary?.streak || 1}</span>
    </div>
  );
}

function TransactionList({ transactions, tx }) {
  const visibleTransactions = transactions.slice(0, 4);

  return (
    <aside className="daily-reward-transactions" aria-label={tx('Recent wallet transactions')}>
      <span className="daily-reward-transactions__title">{tx('RECENT TRANSACTIONS')}</span>
      {visibleTransactions.length ? visibleTransactions.map((transaction) => {
        const isPositive = Number(transaction.amount || 0) >= 0;
        const amountLabel = `${isPositive ? '+' : ''}${formatAmount(transaction.amount)} ${String(transaction.currency || '').toUpperCase()}`;
        return (
          <div className="daily-reward-transaction" key={transaction.id}>
            <span className="daily-reward-transaction__reason">{tx(transaction.reason || formatTransactionType(transaction.type))}</span>
            <span className={`daily-reward-transaction__amount daily-reward-transaction__amount--${isPositive ? 'positive' : 'negative'}`}>{amountLabel}</span>
            <span className="daily-reward-transaction__date">{formatDateTime(transaction.createdAt)}</span>
          </div>
        );
      }) : (
        <span className="daily-reward-transactions__empty">{tx('No wallet transactions yet')}</span>
      )}
    </aside>
  );
}

export default function DailyReward({ navigation, data, backendActions, backendStatus, i18n }) {
  const tx = i18n?.tx || ((value) => value);
  const isChinese = i18n?.language === 'zh';
  const dailyBannerSrc = isChinese ? '/assets/liars-dice/localized/zh/daily-banner.png' : `${asset}pbaer.png`;
  const user = data?.user || {};
  const wallet = data?.wallet || {};
  const rewardDays = data?.dailyRewards || [];
  const summary = data?.dailyRewardSummary || {};
  const [now, setNow] = useState(Date.now());

  const isClaiming = backendStatus?.loading && backendStatus?.lastAction === 'rewards.claimDaily';
  const claimError = backendStatus?.lastAction === 'rewards.claimDaily' ? backendStatus?.error : null;
  const hasClaimable = useMemo(() => rewardDays.some((reward) => reward.state === 'claimable'), [rewardDays]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  return (
    <section className="screen daily-reward-screen" aria-label={tx('Daily Reward')}>
      <TopProfile navigation={navigation} user={user} tx={tx} />
      <Currency type="coins" icon="6.png" value={wallet.coins || '0'} />
      <Currency type="gems" icon="7.png" value={wallet.gems || '0'} />

      <img className="daily-reward-banner" src={dailyBannerSrc} alt={tx('Claim 7 days in a row to unlock the Royal Chest')} draggable="false" />

      <DailyRewardStatus summary={summary} hasClaimable={hasClaimable} now={now} tx={tx} />

      {claimError ? <div className="daily-reward-error" role="alert">{tx(claimError)}</div> : null}

      <div className="daily-reward-cards" aria-label={tx('Daily rewards')}>
        {rewardDays.map((reward) => (
          <RewardCard
            key={reward.key || reward.id}
            reward={reward}
            onClaim={backendActions?.claimDailyReward}
            tx={tx}
            disabled={isClaiming}
            isClaiming={isClaiming}
          />
        ))}
      </div>


      <button className="daily-reward-back" type="button" onClick={navigation.goMainMenu}>
        <img className="daily-reward-back__skin" src={`${asset}B2.png`} alt="" draggable="false" />
        <span>{tx('BACK')}</span>
      </button>
    </section>
  );
}
