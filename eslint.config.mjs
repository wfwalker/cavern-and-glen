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
  {
    // Add your custom rule block as an object in the array
    rules: {
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            'structuredClone': {
              message: 'Do not use global structuredClone on objects with methods. It strips prototype chains! Use custom .clone() instead.',
              suggest: ['clone']
            }
          }
        }
      ]
    }
  }  
);
