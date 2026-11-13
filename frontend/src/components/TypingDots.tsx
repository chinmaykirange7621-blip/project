import { motion } from 'framer-motion';

export function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="ScholarAI is thinking">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"
          animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.75, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
      <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        Retrieving schemes &amp; evaluating rules...
      </span>
    </div>
  );
}
