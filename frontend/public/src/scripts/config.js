tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { sans: ['Inter', 'sans-serif'] },
            colors: {
                brand: {
                    dark:       '#0f172a',
                    green:      '#059669',
                    light:      '#e2e8f0',
                    darkBg:     '#0B1121',
                    darkCard:   '#151E32',
                    darkBorder: '#2A364D',
                }
            }
        }
    }
};

const CATEGORIES = ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Outros'];
const CATEGORY_COLORS = {
    'Moradia':     '#3b82f6',
    'Alimentação': '#10b981',
    'Transporte':  '#8b5cf6',
    'Lazer':       '#f59e0b',
    'Saúde':       '#ef4444',
    'Receita':     '#059669',
    'Outros':      '#6b7280',
};
