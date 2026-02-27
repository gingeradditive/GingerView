module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        // GingerView Color Palette
        white: '#FFFFFF',
        background: '#F5F5F5',
        gray: '#C8C8C8',
        redGinger: '#D72E28',
        black: '#111111',
        
        // Semantic mappings
        card: '#FFFFFF',
        border: '#C8C8C8',
        input: '#FFFFFF',
        ring: '#D72E28',
        primary: {
          DEFAULT: '#D72E28',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F5F5F5',
          foreground: '#111111',
        },
        muted: {
          DEFAULT: '#F5F5F5',
          foreground: '#C8C8C8',
        },
        accent: {
          DEFAULT: '#F5F5F5',
          foreground: '#D72E28',
        },
        destructive: {
          DEFAULT: '#D72E28',
          foreground: '#FFFFFF',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
};
