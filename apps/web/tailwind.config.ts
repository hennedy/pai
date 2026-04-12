import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        sidebar: {
          bg: 'hsl(var(--sidebar-bg))',
          foreground: 'hsl(var(--sidebar-foreground))',
          muted: 'hsl(var(--sidebar-muted))',
          accent: 'hsl(var(--sidebar-accent))',
          border: 'hsl(var(--sidebar-border))',
        },
        // Extended amber palette for direct use
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Warm brown palette
        warm: {
          50: '#fdf8f0',
          100: '#f5ead6',
          200: '#ebd5b0',
          300: '#ddb87a',
          400: '#cf9a4e',
          500: '#b87d32',
          600: '#9a6428',
          700: '#7c4f22',
          800: '#5e3b1a',
          900: '#3d2712',
          950: '#241709',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      letterSpacing: {
        'tightest': '-0.03em',
      },
      boxShadow: {
        'warm-sm': '0 1px 2px 0 rgb(146 64 14 / 0.04)',
        'warm': '0 1px 3px 0 rgb(146 64 14 / 0.06), 0 1px 2px -1px rgb(146 64 14 / 0.06)',
        'warm-md': '0 4px 6px -1px rgb(146 64 14 / 0.06), 0 2px 4px -2px rgb(146 64 14 / 0.06)',
        'warm-lg': '0 10px 15px -3px rgb(146 64 14 / 0.07), 0 4px 6px -4px rgb(146 64 14 / 0.07)',
        'warm-xl': '0 20px 25px -5px rgb(146 64 14 / 0.08), 0 8px 10px -6px rgb(146 64 14 / 0.08)',
        'glow': '0 0 20px rgb(245 158 11 / 0.15)',
        'glow-lg': '0 0 40px rgb(245 158 11 / 0.2)',
        'inner-warm': 'inset 0 2px 4px 0 rgb(146 64 14 / 0.04)',
      },
      backgroundImage: {
        'gradient-warm': 'linear-gradient(135deg, hsl(35 40% 97%) 0%, hsl(40 33% 95%) 100%)',
        'gradient-warm-dark': 'linear-gradient(135deg, hsl(25 20% 8%) 0%, hsl(25 18% 11%) 100%)',
        'gradient-amber': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, hsl(28 25% 15%) 0%, hsl(25 22% 12%) 100%)',
        'gradient-sidebar-dark': 'linear-gradient(180deg, hsl(25 22% 8%) 0%, hsl(25 20% 6%) 100%)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
