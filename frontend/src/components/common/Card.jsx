import { motion } from 'framer-motion';

const HAS_PADDING = /(^|\s)p-\d/;

/**
 * Rounded surface. Pass `interactive` for a subtle lift on hover.
 * Default padding is only applied when the caller does not supply its own `p-*` class.
 */
export default function Card({ children, className = '', interactive = false, ...props }) {
  const classes = `section-card ${HAS_PADDING.test(className) ? '' : 'p-6'} ${className}`;

  if (interactive) {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className={`${classes} transition-shadow hover:shadow-soft`}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
