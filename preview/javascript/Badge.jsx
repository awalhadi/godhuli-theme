import { memo } from 'react';
import PropTypes from 'prop-types';

const TONES = {
  pending: { bg: '#fef3c7', fg: '#92400e', icon: '⏳' },
  paid: { bg: '#dcfce7', fg: '#166534', icon: '✓' },
  shipped: { bg: '#dbeafe', fg: '#1e40af', icon: '\u{1F69A}' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b', icon: null },
};

/**
 * Small status pill for an order, with optional tag chips.
 * TODO: switch inline styles to CSS modules once the design tokens land.
 */
function Badge({ status = 'pending', label, tags = [], count = 0, onDismiss, compact = false }) {
  const tone = TONES[status] ?? TONES.pending;
  const text = label ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`badge badge--${status}${compact ? ' badge--compact' : ''}`}
      style={{ backgroundColor: tone.bg, color: tone.fg, padding: compact ? 2 : '4px 8px' }}
      data-count={count}
      role="status"
      aria-label={`Order status: ${text}`}
    >
      {tone.icon && <span aria-hidden="true">{tone.icon}</span>}
      {text}
      {count > 0 ? <sup className="badge__count">{count > 99 ? '99+' : count}</sup> : null}

      {tags.length > 0 && (
        <ul className="badge__tags">
          {tags.map(({ id, name, color = 'gray' }) => (
            <li key={id} className={`chip chip--${color}`}>
              #{name}
            </li>
          ))}
        </ul>
      )}

      {onDismiss && (
        <button type="button" onClick={() => onDismiss(status)} aria-label="Dismiss">
          &times;
        </button>
      )}
    </span>
  );
}

Badge.propTypes = {
  status: PropTypes.oneOf(Object.keys(TONES)),
  label: PropTypes.string,
  count: PropTypes.number,
  compact: PropTypes.bool,
  onDismiss: PropTypes.func,
  tags: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string })),
};

export default memo(Badge);
