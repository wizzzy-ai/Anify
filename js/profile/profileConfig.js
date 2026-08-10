(function (global) {
    'use strict';

    const DEFAULT_PROFILE_THEME = 'default';
    const DEFAULT_AVATAR_ID = 'shadow';
    const PROFILE_THEME_IDS = [
        'default', 'crimson', 'ocean', 'sakura', 'emerald',
        'violet', 'azure', 'sunset', 'ice', 'cyber', 'royal',
    ];

    const PROFILE_THEMES = {
        default: {
            id: 'default',
            label: 'Anify Default',
            description: 'Gold, dark purple, and black — the classic Anify look.',
            tokens: {
                primary: '#FBBF24', primaryHover: '#F59E0B', primaryLight: '#FDE68A', primaryDark: '#B45309',
                accent: '#8B5CF6', accentSoft: 'rgba(139, 92, 246, 0.16)',
                background: '#01010C', surface: '#0A0A1C', surfaceHover: '#16162A', surfaceStrong: '#111321',
                border: 'rgba(255, 255, 255, 0.10)', textPrimary: '#FFFFFF', textSecondary: '#D1D5DB', textTertiary: '#9CA3AF',
                success: '#34D399', danger: '#F87171', shadow: 'rgba(0, 0, 0, 0.50)',
                scrollbarThumb: 'rgba(251, 191, 36, 0.30)', scrollbarThumbHover: 'rgba(251, 191, 36, 0.55)', buttonText: '#09090B',
            },
        },
        crimson: {
            id: 'crimson', label: 'Crimson', description: 'Dramatic red energy with deep wine surfaces.',
            tokens: {
                primary: '#F43F5E', primaryHover: '#E11D48', primaryLight: '#FDA4AF', primaryDark: '#9F1239',
                accent: '#FB7185', accentSoft: 'rgba(244, 63, 94, 0.16)', background: '#10050B', surface: '#210A14', surfaceHover: '#35101D', surfaceStrong: '#2B0D18',
                border: 'rgba(251, 113, 133, 0.24)', textPrimary: '#FFF7F8', textSecondary: '#FBCFE8', textTertiary: '#FDA4AF',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(0, 0, 0, 0.58)', scrollbarThumb: 'rgba(244, 63, 94, 0.34)', scrollbarThumbHover: 'rgba(244, 63, 94, 0.62)', buttonText: '#2B0713',
            },
        },
        ocean: {
            id: 'ocean', label: 'Ocean', description: 'Cobalt depth balanced with clear cyan highlights.',
            tokens: {
                primary: '#38BDF8', primaryHover: '#0EA5E9', primaryLight: '#BAE6FD', primaryDark: '#0369A1',
                accent: '#22D3EE', accentSoft: 'rgba(34, 211, 238, 0.16)', background: '#03111F', surface: '#071D32', surfaceHover: '#0D2B46', surfaceStrong: '#0A233A',
                border: 'rgba(125, 211, 252, 0.22)', textPrimary: '#F0F9FF', textSecondary: '#BAE6FD', textTertiary: '#7DD3FC',
                success: '#34D399', danger: '#FB7185', shadow: 'rgba(1, 11, 24, 0.62)', scrollbarThumb: 'rgba(56, 189, 248, 0.34)', scrollbarThumbHover: 'rgba(56, 189, 248, 0.62)', buttonText: '#032033',
            },
        },
        sakura: {
            id: 'sakura', label: 'Sakura', description: 'Soft pink warmth with plum-purple contrast.',
            tokens: {
                primary: '#F472B6', primaryHover: '#EC4899', primaryLight: '#FBCFE8', primaryDark: '#9D174D',
                accent: '#C084FC', accentSoft: 'rgba(244, 114, 182, 0.17)', background: '#160817', surface: '#29102A', surfaceHover: '#42163F', surfaceStrong: '#341334',
                border: 'rgba(249, 168, 212, 0.23)', textPrimary: '#FFF7FB', textSecondary: '#FCE7F3', textTertiary: '#F9A8D4',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(19, 2, 20, 0.58)', scrollbarThumb: 'rgba(244, 114, 182, 0.34)', scrollbarThumbHover: 'rgba(244, 114, 182, 0.62)', buttonText: '#380A26',
            },
        },
        emerald: {
            id: 'emerald', label: 'Emerald', description: 'Fresh green accents over obsidian forest tones.',
            tokens: {
                primary: '#34D399', primaryHover: '#10B981', primaryLight: '#A7F3D0', primaryDark: '#047857',
                accent: '#2DD4BF', accentSoft: 'rgba(52, 211, 153, 0.16)', background: '#03130F', surface: '#08241B', surfaceHover: '#0E3728', surfaceStrong: '#0B2D22',
                border: 'rgba(110, 231, 183, 0.22)', textPrimary: '#F0FDF4', textSecondary: '#BBF7D0', textTertiary: '#86EFAC',
                success: '#86EFAC', danger: '#FB7185', shadow: 'rgba(0, 15, 10, 0.62)', scrollbarThumb: 'rgba(52, 211, 153, 0.34)', scrollbarThumbHover: 'rgba(52, 211, 153, 0.62)', buttonText: '#032217',
            },
        },
        violet: {
            id: 'violet', label: 'Violet', description: 'Electric purple tones for a mysterious streaming room.',
            tokens: {
                primary: '#A78BFA', primaryHover: '#8B5CF6', primaryLight: '#DDD6FE', primaryDark: '#6D28D9',
                accent: '#C084FC', accentSoft: 'rgba(167, 139, 250, 0.18)', background: '#0A0618', surface: '#180D2D', surfaceHover: '#27164A', surfaceStrong: '#20113D',
                border: 'rgba(196, 181, 253, 0.24)', textPrimary: '#FAF5FF', textSecondary: '#E9D5FF', textTertiary: '#C4B5FD',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(6, 2, 18, 0.64)', scrollbarThumb: 'rgba(167, 139, 250, 0.34)', scrollbarThumbHover: 'rgba(167, 139, 250, 0.62)', buttonText: '#170B2C',
            },
        },
        azure: {
            id: 'azure', label: 'Azure', description: 'Bright blue clarity with a navy foundation.',
            tokens: {
                primary: '#60A5FA', primaryHover: '#3B82F6', primaryLight: '#BFDBFE', primaryDark: '#1D4ED8',
                accent: '#818CF8', accentSoft: 'rgba(96, 165, 250, 0.17)', background: '#050C1F', surface: '#0A1732', surfaceHover: '#11254C', surfaceStrong: '#0D1D3E',
                border: 'rgba(147, 197, 253, 0.23)', textPrimary: '#EFF6FF', textSecondary: '#DBEAFE', textTertiary: '#93C5FD',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(1, 8, 29, 0.62)', scrollbarThumb: 'rgba(96, 165, 250, 0.34)', scrollbarThumbHover: 'rgba(96, 165, 250, 0.62)', buttonText: '#06152E',
            },
        },
        sunset: {
            id: 'sunset', label: 'Sunset', description: 'Hot orange light fading into crimson night.',
            tokens: {
                primary: '#FB923C', primaryHover: '#F97316', primaryLight: '#FED7AA', primaryDark: '#C2410C',
                accent: '#F43F5E', accentSoft: 'rgba(251, 146, 60, 0.17)', background: '#16070A', surface: '#2A1110', surfaceHover: '#451B16', surfaceStrong: '#351513',
                border: 'rgba(253, 186, 116, 0.23)', textPrimary: '#FFF7ED', textSecondary: '#FFEDD5', textTertiary: '#FDBA74',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(24, 5, 1, 0.62)', scrollbarThumb: 'rgba(251, 146, 60, 0.34)', scrollbarThumbHover: 'rgba(251, 146, 60, 0.62)', buttonText: '#351007',
            },
        },
        ice: {
            id: 'ice', label: 'Ice', description: 'Cool cyan light across a midnight blue canvas.',
            tokens: {
                primary: '#67E8F9', primaryHover: '#22D3EE', primaryLight: '#CFFAFE', primaryDark: '#0E7490',
                accent: '#93C5FD', accentSoft: 'rgba(103, 232, 249, 0.17)', background: '#04121C', surface: '#0B2634', surfaceHover: '#123D4E', surfaceStrong: '#0E3242',
                border: 'rgba(165, 243, 252, 0.24)', textPrimary: '#ECFEFF', textSecondary: '#CFFAFE', textTertiary: '#A5F3FC',
                success: '#6EE7B7', danger: '#FDA4AF', shadow: 'rgba(1, 13, 20, 0.64)', scrollbarThumb: 'rgba(103, 232, 249, 0.34)', scrollbarThumbHover: 'rgba(103, 232, 249, 0.62)', buttonText: '#06202A',
            },
        },
        cyber: {
            id: 'cyber', label: 'Cyber', description: 'Neon cyan and electric purple in a black arcade.',
            tokens: {
                primary: '#22D3EE', primaryHover: '#06B6D4', primaryLight: '#A5F3FC', primaryDark: '#0E7490',
                accent: '#D946EF', accentSoft: 'rgba(217, 70, 239, 0.18)', background: '#05050B', surface: '#11101C', surfaceHover: '#1E1930', surfaceStrong: '#171526',
                border: 'rgba(103, 232, 249, 0.24)', textPrimary: '#F5F3FF', textSecondary: '#E0E7FF', textTertiary: '#A5B4FC',
                success: '#2DD4BF', danger: '#FB7185', shadow: 'rgba(0, 0, 0, 0.72)', scrollbarThumb: 'rgba(34, 211, 238, 0.36)', scrollbarThumbHover: 'rgba(217, 70, 239, 0.66)', buttonText: '#03151A',
            },
        },
        royal: {
            id: 'royal', label: 'Royal', description: 'Regal blue, polished gold, and deep navy.',
            tokens: {
                primary: '#FACC15', primaryHover: '#EAB308', primaryLight: '#FEF08A', primaryDark: '#A16207',
                accent: '#60A5FA', accentSoft: 'rgba(96, 165, 250, 0.17)', background: '#050B20', surface: '#0A1838', surfaceHover: '#122957', surfaceStrong: '#0E2148',
                border: 'rgba(147, 197, 253, 0.24)', textPrimary: '#FFFBEB', textSecondary: '#E0E7FF', textTertiary: '#BFDBFE',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(1, 7, 27, 0.65)', scrollbarThumb: 'rgba(250, 204, 21, 0.34)', scrollbarThumbHover: 'rgba(250, 204, 21, 0.62)', buttonText: '#241700',
            },
        },
    };

    const PROFILE_AVATARS = [
        { id: 'shadow', label: 'Shadow', category: 'Black-haired', seed: 'anify-shadow', background: '17152d' },
        { id: 'moon', label: 'Moon', category: 'White-haired', seed: 'anify-moon', background: '24344d' },
        { id: 'ember', label: 'Ember', category: 'Red-haired', seed: 'anify-ember', background: '4a1d2a' },
        { id: 'tide', label: 'Tide', category: 'Blue-haired', seed: 'anify-tide', background: '123d54' },
        { id: 'orchid', label: 'Orchid', category: 'Purple-haired', seed: 'anify-orchid', background: '351c51' },
        { id: 'solar', label: 'Solar', category: 'Blonde', seed: 'anify-solar', background: '604218' },
        { id: 'mask', label: 'Mask', category: 'Masked', seed: 'anify-mask', background: '20222d' },
        { id: 'ninja', label: 'Ninja', category: 'Ninja-inspired', seed: 'anify-ninja', background: '182a2e' },
        { id: 'samurai', label: 'Samurai', category: 'Samurai-inspired', seed: 'anify-samurai', background: '3d241d' },
        { id: 'chibi', label: 'Chibi', category: 'Cute chibi', seed: 'anify-chibi', background: '61304b' },
        { id: 'nocturne', label: 'Nocturne', category: 'Mysterious', seed: 'anify-nocturne', background: '14151f' },
        { id: 'fae', label: 'Fae', category: 'Fantasy', seed: 'anify-fae', background: '214044' },
        { id: 'storm', label: 'Storm', category: 'Silver-haired', seed: 'anify-storm', background: '26324b' },
        { id: 'rosewood', label: 'Rosewood', category: 'Rose-haired', seed: 'anify-rosewood', background: '4b2035' },
        { id: 'starlight', label: 'Starlight', category: 'Androgynous', seed: 'anify-starlight', background: '28244b' },
        { id: 'rune', label: 'Rune', category: 'Arcane', seed: 'anify-rune', background: '263d31' },
        { id: 'aqua', label: 'Aqua', category: 'Aqua-haired', seed: 'anify-aqua', background: '174c61' },
        { id: 'scarlet', label: 'Scarlet', category: 'Crimson', seed: 'anify-scarlet', background: '541c23' },
        { id: 'sage', label: 'Sage', category: 'Nature-inspired', seed: 'anify-sage', background: '2e4630' },
        { id: 'onyx', label: 'Onyx', category: 'Dark fantasy', seed: 'anify-onyx', background: '171717' },
    ];

    const LEGACY_THEME_MAP = { gold: 'default', rose: 'sakura', violet: 'violet', ocean: 'ocean' };

    function normalizeThemeId(value) {
        const candidate = String(value || '').trim().toLowerCase();
        const mapped = LEGACY_THEME_MAP[candidate] || candidate;
        return PROFILE_THEME_IDS.includes(mapped) ? mapped : DEFAULT_PROFILE_THEME;
    }

    function normalizeAvatarId(value) {
        const candidate = String(value || '').trim().toLowerCase();
        return PROFILE_AVATARS.some((avatar) => avatar.id === candidate) ? candidate : DEFAULT_AVATAR_ID;
    }

    function getAvatar(avatarId) {
        return PROFILE_AVATARS.find((avatar) => avatar.id === normalizeAvatarId(avatarId)) || PROFILE_AVATARS[0];
    }

    function getAvatarUrl(avatarId) {
        const avatar = getAvatar(avatarId);
        return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(avatar.seed)}&backgroundType=solid&backgroundColor=${avatar.background}`;
    }

    global.AnifyProfileConfig = {
        DEFAULT_PROFILE_THEME,
        DEFAULT_AVATAR_ID,
        PROFILE_THEME_IDS,
        PROFILE_THEMES,
        PROFILE_AVATARS,
        normalizeThemeId,
        normalizeAvatarId,
        getAvatar,
        getAvatarUrl,
    };
})(window);
