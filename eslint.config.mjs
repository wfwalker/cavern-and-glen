import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // FIX: Use 'ignores' in a standalone object at the top
  { 
    ignores: ['dist/**', 'node_modules/**', 'not-in-use/**', '.vite/**'] 
  },
  
  // Extend recommended rulesets
  js.configs.recommended,
  ...tseslint.configs.recommended,
  
  // Custom rule Overrides
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
