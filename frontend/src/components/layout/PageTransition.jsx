import { motion } from 'framer-motion';

const VARIANTS = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }
};

/** Fade + slide wrapper used for route changes. */
export default function PageTransition({ children }) {
  return (
    <motion.div variants={VARIANTS} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}
