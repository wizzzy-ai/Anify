(function (global) {
    'use strict';

    const DEFAULT_PROFILE_THEME = 'default';
    const DEFAULT_AVATAR_ID = 'shadow';
    const PROFILE_THEME_IDS = [
        'default', 'crimson', 'ocean', 'sakura', 'emerald',
        'violet', 'azure', 'sunset', 'ice', 'cyber', 'royal',
        'blush', 'peony', 'fuchsia', 'berry', 'coral', 'ash-plum', 'pink',
        'obsidian', 'red', 'cobalt-sand', 'ink-peach', 'khaki-violet', 'rosewood-sage-navy', 'cotton-candy', 'rose-gold',
    ];

    // Light variants intentionally keep the same semantic token shape as dark
    // variants so the runtime can swap appearance without changing profile ids.
    function createLightTokens({
        primary,
        primaryHover,
        primaryLight,
        primaryDark,
        accent,
        background,
        surface,
        surfaceHover,
        surfaceStrong,
        buttonText,
    }) {
        const textPrimary = '#172033';
        const textSecondary = '#475569';
        const textTertiary = '#64748B';
        const border = `color-mix(in srgb, ${primary} 18%, #CBD5E1)`;

        return {
            primary,
            primaryHover,
            primaryLight,
            primaryDark,
            accent,
            accentSoft: `color-mix(in srgb, ${accent} 16%, transparent)`,
            accentGold: primary,
            accentPurple: accent,
            background,
            surface,
            surfaceHover,
            surfaceStrong,
            border,
            textPrimary,
            textSecondary,
            textTertiary,
            success: '#16A34A',
            danger: '#DC2626',
            shadow: 'rgba(15, 23, 42, 0.16)',
            scrollbarThumb: `color-mix(in srgb, ${primary} 44%, transparent)`,
            scrollbarThumbHover: `color-mix(in srgb, ${primary} 64%, transparent)`,
            buttonText,
            cardBackground: `color-mix(in srgb, ${surface} 88%, transparent)`,
            modalBackground: `linear-gradient(135deg, ${surface}, ${surfaceStrong})`,
            modalInner: `linear-gradient(180deg, color-mix(in srgb, ${accent} 10%, transparent), transparent 50%)`,
            borderColor: border,
            hoverBackground: `color-mix(in srgb, ${primary} 10%, ${surface})`,
            overlay: 'rgba(15, 23, 42, 0.38)',
            focusRing: `color-mix(in srgb, ${primary} 30%, transparent)`,
            surfaceMuted: `color-mix(in srgb, ${textPrimary} 4%, transparent)`,
        };
    }

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
            lightTokens: createLightTokens({
                primary: '#D97706', primaryHover: '#B45309', primaryLight: '#FCD34D', primaryDark: '#92400E', accent: '#7C3AED',
                background: '#FFFDF8', surface: '#FFFFFF', surfaceHover: '#FFF7ED', surfaceStrong: '#FFFBEB', buttonText: '#201506',
            }),
        },
        crimson: {
            id: 'crimson', label: 'Crimson', description: 'Dramatic red energy with deep wine surfaces.',
            tokens: {
                primary: '#F43F5E', primaryHover: '#E11D48', primaryLight: '#FDA4AF', primaryDark: '#9F1239',
                accent: '#FB7185', accentSoft: 'rgba(244, 63, 94, 0.16)', background: '#10050B', surface: '#210A14', surfaceHover: '#35101D', surfaceStrong: '#2B0D18',
                border: 'rgba(251, 113, 133, 0.24)', textPrimary: '#FFF7F8', textSecondary: '#FBCFE8', textTertiary: '#FDA4AF',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(0, 0, 0, 0.58)', scrollbarThumb: 'rgba(244, 63, 94, 0.34)', scrollbarThumbHover: 'rgba(244, 63, 94, 0.62)', buttonText: '#2B0713',
            },
            lightTokens: createLightTokens({
                primary: '#E11D48', primaryHover: '#BE123C', primaryLight: '#FDA4AF', primaryDark: '#9F1239', accent: '#BE123C',
                background: '#FFF5F7', surface: '#FFFFFF', surfaceHover: '#FFF1F2', surfaceStrong: '#FFE4E6', buttonText: '#FFFFFF',
            }),
        },
        ocean: {
            id: 'ocean', label: 'Ocean', description: 'Cobalt depth balanced with clear cyan highlights.',
            tokens: {
                primary: '#38BDF8', primaryHover: '#0EA5E9', primaryLight: '#BAE6FD', primaryDark: '#0369A1',
                accent: '#22D3EE', accentSoft: 'rgba(34, 211, 238, 0.16)', background: '#03111F', surface: '#071D32', surfaceHover: '#0D2B46', surfaceStrong: '#0A233A',
                border: 'rgba(125, 211, 252, 0.22)', textPrimary: '#F0F9FF', textSecondary: '#BAE6FD', textTertiary: '#7DD3FC',
                success: '#34D399', danger: '#FB7185', shadow: 'rgba(1, 11, 24, 0.62)', scrollbarThumb: 'rgba(56, 189, 248, 0.34)', scrollbarThumbHover: 'rgba(56, 189, 248, 0.62)', buttonText: '#032033',
            },
            lightTokens: createLightTokens({
                primary: '#0284C7', primaryHover: '#0369A1', primaryLight: '#7DD3FC', primaryDark: '#075985', accent: '#0891B2',
                background: '#F0F9FF', surface: '#FFFFFF', surfaceHover: '#E0F2FE', surfaceStrong: '#F0FDFA', buttonText: '#FFFFFF',
            }),
        },
        sakura: {
            id: 'sakura', label: 'Sakura', description: 'Soft pink warmth with plum-purple contrast.',
            tokens: {
                primary: '#F472B6', primaryHover: '#EC4899', primaryLight: '#FBCFE8', primaryDark: '#9D174D',
                accent: '#C084FC', accentSoft: 'rgba(244, 114, 182, 0.17)', background: '#160817', surface: '#29102A', surfaceHover: '#42163F', surfaceStrong: '#341334',
                border: 'rgba(249, 168, 212, 0.23)', textPrimary: '#FFF7FB', textSecondary: '#FCE7F3', textTertiary: '#F9A8D4',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(19, 2, 20, 0.58)', scrollbarThumb: 'rgba(244, 114, 182, 0.34)', scrollbarThumbHover: 'rgba(244, 114, 182, 0.62)', buttonText: '#380A26',
            },
            lightTokens: createLightTokens({
                primary: '#DB2777', primaryHover: '#BE185D', primaryLight: '#F9A8D4', primaryDark: '#9D174D', accent: '#9333EA',
                background: '#FFF7FB', surface: '#FFFFFF', surfaceHover: '#FDF2F8', surfaceStrong: '#FCE7F3', buttonText: '#FFFFFF',
            }),
        },
        emerald: {
            id: 'emerald', label: 'Emerald', description: 'Fresh green accents over obsidian forest tones.',
            tokens: {
                primary: '#34D399', primaryHover: '#10B981', primaryLight: '#A7F3D0', primaryDark: '#047857',
                accent: '#2DD4BF', accentSoft: 'rgba(52, 211, 153, 0.16)', background: '#03130F', surface: '#08241B', surfaceHover: '#0E3728', surfaceStrong: '#0B2D22',
                border: 'rgba(110, 231, 183, 0.22)', textPrimary: '#F0FDF4', textSecondary: '#BBF7D0', textTertiary: '#86EFAC',
                success: '#86EFAC', danger: '#FB7185', shadow: 'rgba(0, 15, 10, 0.62)', scrollbarThumb: 'rgba(52, 211, 153, 0.34)', scrollbarThumbHover: 'rgba(52, 211, 153, 0.62)', buttonText: '#032217',
            },
            lightTokens: createLightTokens({
                primary: '#059669', primaryHover: '#047857', primaryLight: '#6EE7B7', primaryDark: '#065F46', accent: '#0D9488',
                background: '#F0FDF4', surface: '#FFFFFF', surfaceHover: '#ECFDF5', surfaceStrong: '#D1FAE5', buttonText: '#052E1A',
            }),
        },
        violet: {
            id: 'violet', label: 'Violet', description: 'Electric purple tones for a mysterious streaming room.',
            tokens: {
                primary: '#A78BFA', primaryHover: '#8B5CF6', primaryLight: '#DDD6FE', primaryDark: '#6D28D9',
                accent: '#C084FC', accentSoft: 'rgba(167, 139, 250, 0.18)', background: '#0A0618', surface: '#180D2D', surfaceHover: '#27164A', surfaceStrong: '#20113D',
                border: 'rgba(196, 181, 253, 0.24)', textPrimary: '#FAF5FF', textSecondary: '#E9D5FF', textTertiary: '#C4B5FD',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(6, 2, 18, 0.64)', scrollbarThumb: 'rgba(167, 139, 250, 0.34)', scrollbarThumbHover: 'rgba(167, 139, 250, 0.62)', buttonText: '#170B2C',
            },
            lightTokens: createLightTokens({
                primary: '#7C3AED', primaryHover: '#6D28D9', primaryLight: '#C4B5FD', primaryDark: '#5B21B6', accent: '#9333EA',
                background: '#FAF5FF', surface: '#FFFFFF', surfaceHover: '#F5F3FF', surfaceStrong: '#EDE9FE', buttonText: '#FFFFFF',
            }),
        },
        azure: {
            id: 'azure', label: 'Azure', description: 'Bright blue clarity with a navy foundation.',
            tokens: {
                primary: '#60A5FA', primaryHover: '#3B82F6', primaryLight: '#BFDBFE', primaryDark: '#1D4ED8',
                accent: '#818CF8', accentSoft: 'rgba(96, 165, 250, 0.17)', background: '#050C1F', surface: '#0A1732', surfaceHover: '#11254C', surfaceStrong: '#0D1D3E',
                border: 'rgba(147, 197, 253, 0.23)', textPrimary: '#EFF6FF', textSecondary: '#DBEAFE', textTertiary: '#93C5FD',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(1, 8, 29, 0.62)', scrollbarThumb: 'rgba(96, 165, 250, 0.34)', scrollbarThumbHover: 'rgba(96, 165, 250, 0.62)', buttonText: '#06152E',
            },
            lightTokens: createLightTokens({
                primary: '#2563EB', primaryHover: '#1D4ED8', primaryLight: '#93C5FD', primaryDark: '#1E40AF', accent: '#4F46E5',
                background: '#EFF6FF', surface: '#FFFFFF', surfaceHover: '#DBEAFE', surfaceStrong: '#E0E7FF', buttonText: '#FFFFFF',
            }),
        },
        sunset: {
            id: 'sunset', label: 'Sunset', description: 'Hot orange light fading into crimson night.',
            tokens: {
                primary: '#FB923C', primaryHover: '#F97316', primaryLight: '#FED7AA', primaryDark: '#C2410C',
                accent: '#F43F5E', accentSoft: 'rgba(251, 146, 60, 0.17)', background: '#16070A', surface: '#2A1110', surfaceHover: '#451B16', surfaceStrong: '#351513',
                border: 'rgba(253, 186, 116, 0.23)', textPrimary: '#FFF7ED', textSecondary: '#FFEDD5', textTertiary: '#FDBA74',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(24, 5, 1, 0.62)', scrollbarThumb: 'rgba(251, 146, 60, 0.34)', scrollbarThumbHover: 'rgba(251, 146, 60, 0.62)', buttonText: '#351007',
            },
            lightTokens: createLightTokens({
                primary: '#EA580C', primaryHover: '#C2410C', primaryLight: '#FDBA74', primaryDark: '#9A3412', accent: '#E11D48',
                background: '#FFF7ED', surface: '#FFFFFF', surfaceHover: '#FFEDD5', surfaceStrong: '#FFEDD5', buttonText: '#FFFFFF',
            }),
        },
        ice: {
            id: 'ice', label: 'Ice', description: 'Cool cyan light across a midnight blue canvas.',
            tokens: {
                primary: '#67E8F9', primaryHover: '#22D3EE', primaryLight: '#CFFAFE', primaryDark: '#0E7490',
                accent: '#93C5FD', accentSoft: 'rgba(103, 232, 249, 0.17)', background: '#04121C', surface: '#0B2634', surfaceHover: '#123D4E', surfaceStrong: '#0E3242',
                border: 'rgba(165, 243, 252, 0.24)', textPrimary: '#ECFEFF', textSecondary: '#CFFAFE', textTertiary: '#A5F3FC',
                success: '#6EE7B7', danger: '#FDA4AF', shadow: 'rgba(1, 13, 20, 0.64)', scrollbarThumb: 'rgba(103, 232, 249, 0.34)', scrollbarThumbHover: 'rgba(103, 232, 249, 0.62)', buttonText: '#06202A',
            },
            lightTokens: createLightTokens({
                primary: '#0891B2', primaryHover: '#0E7490', primaryLight: '#67E8F9', primaryDark: '#155E75', accent: '#2563EB',
                background: '#ECFEFF', surface: '#FFFFFF', surfaceHover: '#CFFAFE', surfaceStrong: '#E0F2FE', buttonText: '#083344',
            }),
        },
        cyber: {
            id: 'cyber', label: 'Cyber', description: 'Neon cyan and electric purple in a black arcade.',
            tokens: {
                primary: '#22D3EE', primaryHover: '#06B6D4', primaryLight: '#A5F3FC', primaryDark: '#0E7490',
                accent: '#D946EF', accentSoft: 'rgba(217, 70, 239, 0.18)', background: '#05050B', surface: '#11101C', surfaceHover: '#1E1930', surfaceStrong: '#171526',
                border: 'rgba(103, 232, 249, 0.24)', textPrimary: '#F5F3FF', textSecondary: '#E0E7FF', textTertiary: '#A5B4FC',
                success: '#2DD4BF', danger: '#FB7185', shadow: 'rgba(0, 0, 0, 0.72)', scrollbarThumb: 'rgba(34, 211, 238, 0.36)', scrollbarThumbHover: 'rgba(217, 70, 239, 0.66)', buttonText: '#03151A',
            },
            lightTokens: createLightTokens({
                primary: '#0891B2', primaryHover: '#0E7490', primaryLight: '#67E8F9', primaryDark: '#155E75', accent: '#C026D3',
                background: '#F5F3FF', surface: '#FFFFFF', surfaceHover: '#EDE9FE', surfaceStrong: '#FAE8FF', buttonText: '#0F172A',
            }),
        },
        royal: {
            id: 'royal', label: 'Royal', description: 'Regal blue, polished gold, and deep navy.',
            tokens: {
                primary: '#FACC15', primaryHover: '#EAB308', primaryLight: '#FEF08A', primaryDark: '#A16207',
                accent: '#60A5FA', accentSoft: 'rgba(96, 165, 250, 0.17)', background: '#050B20', surface: '#0A1838', surfaceHover: '#122957', surfaceStrong: '#0E2148',
                border: 'rgba(147, 197, 253, 0.24)', textPrimary: '#FFFBEB', textSecondary: '#E0E7FF', textTertiary: '#BFDBFE',
                success: '#4ADE80', danger: '#FB7185', shadow: 'rgba(1, 7, 27, 0.65)', scrollbarThumb: 'rgba(250, 204, 21, 0.34)', scrollbarThumbHover: 'rgba(250, 204, 21, 0.62)', buttonText: '#241700',
            },
            lightTokens: createLightTokens({
                primary: '#CA8A04', primaryHover: '#A16207', primaryLight: '#FDE047', primaryDark: '#854D0E', accent: '#2563EB',
                background: '#F8FAFC', surface: '#FFFFFF', surfaceHover: '#EFF6FF', surfaceStrong: '#FEF3C7', buttonText: '#1C1917',
            }),
        },
        blush: {
            id: 'blush', label: 'Blush', description: 'Rosy pink light over a deep berry lounge.',
            tokens: {
                primary: '#FB7185', primaryHover: '#F43F5E', primaryLight: '#FDA4AF', primaryDark: '#BE123C',
                accent: '#F9A8D4', accentSoft: 'rgba(251, 113, 133, 0.17)', background: '#18070F', surface: '#2B0D1B', surfaceHover: '#45152B', surfaceStrong: '#37101F',
                border: 'rgba(251, 113, 133, 0.24)', textPrimary: '#FFF1F2', textSecondary: '#FECDD3', textTertiary: '#FDA4AF',
                success: '#86EFAC', danger: '#FB7185', shadow: 'rgba(30, 3, 13, 0.62)', scrollbarThumb: 'rgba(251, 113, 133, 0.34)', scrollbarThumbHover: 'rgba(251, 113, 133, 0.62)', buttonText: '#3B0715',
            },
            lightTokens: createLightTokens({
                primary: '#E11D48', primaryHover: '#BE123C', primaryLight: '#FDA4AF', primaryDark: '#9F1239', accent: '#DB2777',
                background: '#FFF1F2', surface: '#FFFFFF', surfaceHover: '#FFE4E6', surfaceStrong: '#FCE7F3', buttonText: '#FFFFFF',
            }),
        },
        peony: {
            id: 'peony', label: 'Peony', description: 'Lush peony pink with vivid violet sparks.',
            tokens: {
                primary: '#EC4899', primaryHover: '#DB2777', primaryLight: '#F9A8D4', primaryDark: '#9D174D',
                accent: '#D946EF', accentSoft: 'rgba(236, 72, 153, 0.17)', background: '#200A1B', surface: '#38122F', surfaceHover: '#551946', surfaceStrong: '#46143A',
                border: 'rgba(244, 114, 182, 0.25)', textPrimary: '#FFF7FB', textSecondary: '#FCE7F3', textTertiary: '#F9A8D4',
                success: '#86EFAC', danger: '#FB7185', shadow: 'rgba(31, 3, 23, 0.62)', scrollbarThumb: 'rgba(236, 72, 153, 0.34)', scrollbarThumbHover: 'rgba(236, 72, 153, 0.62)', buttonText: '#430A2A',
            },
            lightTokens: createLightTokens({
                primary: '#DB2777', primaryHover: '#BE185D', primaryLight: '#F9A8D4', primaryDark: '#9D174D', accent: '#C026D3',
                background: '#FFF7FB', surface: '#FFFFFF', surfaceHover: '#FCE7F3', surfaceStrong: '#FAE8FF', buttonText: '#FFFFFF',
            }),
        },
        fuchsia: {
            id: 'fuchsia', label: 'Fuchsia', description: 'Electric magenta energy in a neon orchid room.',
            tokens: {
                primary: '#E879F9', primaryHover: '#D946EF', primaryLight: '#F5D0FE', primaryDark: '#A21CAF',
                accent: '#C026D3', accentSoft: 'rgba(232, 121, 249, 0.18)', background: '#17061A', surface: '#2B0F31', surfaceHover: '#43174C', surfaceStrong: '#37123E',
                border: 'rgba(232, 121, 249, 0.24)', textPrimary: '#FDF4FF', textSecondary: '#F5D0FE', textTertiary: '#E879F9',
                success: '#5EEAD4', danger: '#FB7185', shadow: 'rgba(24, 1, 28, 0.68)', scrollbarThumb: 'rgba(232, 121, 249, 0.36)', scrollbarThumbHover: 'rgba(217, 70, 239, 0.66)', buttonText: '#3B0642',
            },
            lightTokens: createLightTokens({
                primary: '#C026D3', primaryHover: '#A21CAF', primaryLight: '#E879F9', primaryDark: '#86198F', accent: '#A21CAF',
                background: '#FDF4FF', surface: '#FFFFFF', surfaceHover: '#FAE8FF', surfaceStrong: '#F5D0FE', buttonText: '#FFFFFF',
            }),
        },
        berry: {
            id: 'berry', label: 'Berry', description: 'Deep raspberry and violet tones with a rich finish.',
            tokens: {
                primary: '#C026D3', primaryHover: '#A21CAF', primaryLight: '#F0ABFC', primaryDark: '#86198F',
                accent: '#BE185D', accentSoft: 'rgba(192, 38, 211, 0.18)', background: '#18071E', surface: '#2F1039', surfaceHover: '#471852', surfaceStrong: '#3B1246',
                border: 'rgba(240, 171, 252, 0.23)', textPrimary: '#FDF4FF', textSecondary: '#F5D0FE', textTertiary: '#E9D5FF',
                success: '#86EFAC', danger: '#FB7185', shadow: 'rgba(22, 2, 31, 0.66)', scrollbarThumb: 'rgba(192, 38, 211, 0.36)', scrollbarThumbHover: 'rgba(190, 24, 93, 0.66)', buttonText: '#300535',
            },
            lightTokens: createLightTokens({
                primary: '#A21CAF', primaryHover: '#86198F', primaryLight: '#E879F9', primaryDark: '#701A75', accent: '#BE185D',
                background: '#FAF5FF', surface: '#FFFFFF', surfaceHover: '#F5D0FE', surfaceStrong: '#FCE7F3', buttonText: '#FFFFFF',
            }),
        },
        coral: {
            id: 'coral', label: 'Coral', description: 'Warm coral glow balanced with ember-red depth.',
            tokens: {
                primary: '#FB7185', primaryHover: '#F43F5E', primaryLight: '#FECDD3', primaryDark: '#BE123C',
                accent: '#FB923C', accentSoft: 'rgba(251, 113, 133, 0.17)', background: '#1C0A0A', surface: '#351512', surfaceHover: '#4C211A', surfaceStrong: '#401A15',
                border: 'rgba(253, 186, 116, 0.24)', textPrimary: '#FFF7ED', textSecondary: '#FFEDD5', textTertiary: '#FDBA74',
                success: '#86EFAC', danger: '#F43F5E', shadow: 'rgba(30, 5, 1, 0.64)', scrollbarThumb: 'rgba(251, 113, 133, 0.34)', scrollbarThumbHover: 'rgba(251, 146, 60, 0.64)', buttonText: '#3B0715',
            },
            lightTokens: createLightTokens({
                primary: '#E11D48', primaryHover: '#BE123C', primaryLight: '#FDA4AF', primaryDark: '#9F1239', accent: '#EA580C',
                background: '#FFF7ED', surface: '#FFFFFF', surfaceHover: '#FFEDD5', surfaceStrong: '#FFE4E6', buttonText: '#FFFFFF',
            }),
        },
        'ash-plum': {
            id: 'ash-plum', label: 'Ash Plum', description: 'Ash gray layers with plum depth and pale-pink highlights.',
            tokens: {
                primary: '#D8B4D0', primaryHover: '#B779A9', primaryLight: '#F3D6EA', primaryDark: '#7C4A70',
                accent: '#C4B5C7', accentSoft: 'rgba(216, 180, 208, 0.16)', background: '#161519', surface: '#29262D', surfaceHover: '#3A3540', surfaceStrong: '#211E25',
                border: 'rgba(243, 214, 234, 0.20)', textPrimary: '#FFF7FC', textSecondary: '#EBDCE8', textTertiary: '#D8B4D0',
                success: '#A7F3D0', danger: '#FDA4AF', shadow: 'rgba(10, 8, 12, 0.68)', scrollbarThumb: 'rgba(216, 180, 208, 0.36)', scrollbarThumbHover: 'rgba(243, 214, 234, 0.66)', buttonText: '#321B2D',
            },
            lightTokens: createLightTokens({
                primary: '#8C4C7A', primaryHover: '#703B61', primaryLight: '#D8B4D0', primaryDark: '#5A2E4C', accent: '#A78B9B',
                background: '#F7F4F7', surface: '#FFFFFF', surfaceHover: '#EEE8EF', surfaceStrong: '#F3D6EA', buttonText: '#FFFFFF',
            }),
        },
        pink: {
            id: 'pink', label: 'Pink', description: 'A sweet candy-pink glow with a deep rose finish.',
            tokens: {
                primary: '#F472B6', primaryHover: '#EC4899', primaryLight: '#F9A8D4', primaryDark: '#BE185D',
                accent: '#FDA4AF', accentSoft: 'rgba(244, 114, 182, 0.18)', background: '#1A0713', surface: '#321126', surfaceHover: '#4A1938', surfaceStrong: '#3D1530',
                border: 'rgba(249, 168, 212, 0.25)', textPrimary: '#FFF7FB', textSecondary: '#FCE7F3', textTertiary: '#F9A8D4',
                success: '#86EFAC', danger: '#FB7185', shadow: 'rgba(30, 3, 21, 0.66)', scrollbarThumb: 'rgba(244, 114, 182, 0.38)', scrollbarThumbHover: 'rgba(249, 168, 212, 0.68)', buttonText: '#500724',
            },
            lightTokens: createLightTokens({
                primary: '#DB2777', primaryHover: '#BE185D', primaryLight: '#F9A8D4', primaryDark: '#9D174D', accent: '#F472B6',
                background: '#FFF5FA', surface: '#FFFFFF', surfaceHover: '#FCE7F3', surfaceStrong: '#FDE2EF', buttonText: '#FFFFFF',
            }),
        },
        obsidian: {
            id: 'obsidian', label: 'Obsidian', description: 'Minimal black, graphite, and silver for a quiet, focused look.',
            tokens: {
                primary: '#D1D5DB', primaryHover: '#F3F4F6', primaryLight: '#E5E7EB', primaryDark: '#9CA3AF',
                accent: '#6B7280', accentSoft: 'rgba(209, 213, 219, 0.12)', background: '#09090B', surface: '#18181B', surfaceHover: '#27272A', surfaceStrong: '#111113',
                border: 'rgba(209, 213, 219, 0.18)', textPrimary: '#FAFAFA', textSecondary: '#D4D4D8', textTertiary: '#A1A1AA',
                success: '#A7F3D0', danger: '#FDA4AF', shadow: 'rgba(0, 0, 0, 0.72)', scrollbarThumb: 'rgba(161, 161, 170, 0.42)', scrollbarThumbHover: 'rgba(228, 228, 231, 0.68)', buttonText: '#18181B',
            },
            lightTokens: createLightTokens({
                primary: '#3F3F46', primaryHover: '#18181B', primaryLight: '#A1A1AA', primaryDark: '#27272A', accent: '#71717A',
                background: '#F4F4F5', surface: '#FFFFFF', surfaceHover: '#E4E4E7', surfaceStrong: '#D4D4D8', buttonText: '#FFFFFF',
            }),
        },
        red: {
            id: 'red', label: 'Red', description: 'A bold, pure red theme with deep red layers.',
            tokens: {
                primary: '#EF4444', primaryHover: '#DC2626', primaryLight: '#FCA5A5', primaryDark: '#B91C1C',
                accent: '#F87171', accentSoft: 'rgba(239, 68, 68, 0.18)', background: '#160606', surface: '#2B0D0D', surfaceHover: '#431515', surfaceStrong: '#350C0C',
                border: 'rgba(252, 165, 165, 0.24)', textPrimary: '#FFF5F5', textSecondary: '#FECACA', textTertiary: '#FCA5A5',
                success: '#FCA5A5', danger: '#EF4444', shadow: 'rgba(24, 0, 0, 0.70)', scrollbarThumb: 'rgba(239, 68, 68, 0.38)', scrollbarThumbHover: 'rgba(252, 165, 165, 0.68)', buttonText: '#450A0A',
            },
            lightTokens: createLightTokens({
                primary: '#DC2626', primaryHover: '#B91C1C', primaryLight: '#FCA5A5', primaryDark: '#991B1B', accent: '#EF4444',
                background: '#FFF5F5', surface: '#FFFFFF', surfaceHover: '#FEE2E2', surfaceStrong: '#FECACA', buttonText: '#FFFFFF',
            }),
        },
        'cobalt-sand': {
            id: 'cobalt-sand', label: 'Cobalt Sand', description: 'Cobalt blue contrast over warm sand and dark-brown layers.',
            tokens: {
                primary: '#60A5FA', primaryHover: '#3B82F6', primaryLight: '#93C5FD', primaryDark: '#1D4ED8',
                accent: '#FCD34D', accentSoft: 'rgba(96, 165, 250, 0.17)', background: '#160F0A', surface: '#2B1B12', surfaceHover: '#402A1A', surfaceStrong: '#23150D',
                border: 'rgba(252, 211, 77, 0.22)', textPrimary: '#FFF7ED', textSecondary: '#FDE7C3', textTertiary: '#FCD34D',
                success: '#86EFAC', danger: '#FDA4AF', shadow: 'rgba(15, 8, 2, 0.68)', scrollbarThumb: 'rgba(96, 165, 250, 0.38)', scrollbarThumbHover: 'rgba(252, 211, 77, 0.68)', buttonText: '#0C1D3A',
            },
            lightTokens: createLightTokens({
                primary: '#2563EB', primaryHover: '#1D4ED8', primaryLight: '#93C5FD', primaryDark: '#1E40AF', accent: '#D97706',
                background: '#FFFBEB', surface: '#FFFFFF', surfaceHover: '#FEF3C7', surfaceStrong: '#FDE7C3', buttonText: '#FFFFFF',
            }),
        },
        'ink-peach': {
            id: 'ink-peach', label: 'Ink Peach', description: 'Quiet ink blue balanced by muted peach and soft gray.',
            tokens: {
                primary: '#93C5FD', primaryHover: '#60A5FA', primaryLight: '#BFDBFE', primaryDark: '#2563EB',
                accent: '#FDBA9A', accentSoft: 'rgba(147, 197, 253, 0.16)', background: '#0C1422', surface: '#1C2735', surfaceHover: '#2A3746', surfaceStrong: '#15202D',
                border: 'rgba(203, 213, 225, 0.20)', textPrimary: '#F8FAFC', textSecondary: '#D6DEE8', textTertiary: '#B8C3D1',
                success: '#86EFAC', danger: '#FDA4AF', shadow: 'rgba(2, 8, 18, 0.68)', scrollbarThumb: 'rgba(147, 197, 253, 0.36)', scrollbarThumbHover: 'rgba(253, 186, 154, 0.66)', buttonText: '#10233B',
            },
            lightTokens: createLightTokens({
                primary: '#2563EB', primaryHover: '#1D4ED8', primaryLight: '#93C5FD', primaryDark: '#1E40AF', accent: '#D97757',
                background: '#F6F7F9', surface: '#FFFFFF', surfaceHover: '#E5E7EB', surfaceStrong: '#FDE2D4', buttonText: '#FFFFFF',
            }),
        },
        'khaki-violet': {
            id: 'khaki-violet', label: 'Khaki Violet', description: 'Earthy khaki and vivid violet over a deep navy base.',
            tokens: {
                primary: '#C4B58A', primaryHover: '#A99A70', primaryLight: '#DED4B6', primaryDark: '#85764F',
                accent: '#C4B5FD', accentSoft: 'rgba(196, 181, 253, 0.17)', background: '#0A1024', surface: '#17203A', surfaceHover: '#25304E', surfaceStrong: '#10182E',
                border: 'rgba(196, 181, 253, 0.22)', textPrimary: '#F8FAFC', textSecondary: '#E3E5EF', textTertiary: '#C4B5FD',
                success: '#86EFAC', danger: '#FDA4AF', shadow: 'rgba(2, 5, 18, 0.70)', scrollbarThumb: 'rgba(196, 181, 253, 0.36)', scrollbarThumbHover: 'rgba(222, 212, 182, 0.66)', buttonText: '#25203A',
            },
            lightTokens: createLightTokens({
                primary: '#887747', primaryHover: '#6E6038', primaryLight: '#C4B58A', primaryDark: '#5D512F', accent: '#7C3AED',
                background: '#FAFAF7', surface: '#FFFFFF', surfaceHover: '#F0EEDF', surfaceStrong: '#EDE9FE', buttonText: '#FFFFFF',
            }),
        },
        'rosewood-sage-navy': {
            id: 'rosewood-sage-navy', label: 'Rosewood Sage Navy', description: 'Rosewood warmth and calm sage over an inky navy base.',
            tokens: {
                primary: '#C98F9A', primaryHover: '#AF7180', primaryLight: '#E8BAC3', primaryDark: '#824B59',
                accent: '#A7C4AC', accentSoft: 'rgba(167, 196, 172, 0.16)', background: '#0B1325', surface: '#19243A', surfaceHover: '#28354D', surfaceStrong: '#111C31',
                border: 'rgba(167, 196, 172, 0.21)', textPrimary: '#F9FAFB', textSecondary: '#DFE6E7', textTertiary: '#A7C4AC',
                success: '#A7E3B0', danger: '#FDA4AF', shadow: 'rgba(2, 7, 19, 0.70)', scrollbarThumb: 'rgba(201, 143, 154, 0.36)', scrollbarThumbHover: 'rgba(167, 196, 172, 0.66)', buttonText: '#361C29',
            },
            lightTokens: createLightTokens({
                primary: '#9B5666', primaryHover: '#824B59', primaryLight: '#E8BAC3', primaryDark: '#703D4A', accent: '#5F8A69',
                background: '#F7F8F6', surface: '#FFFFFF', surfaceHover: '#E8EEE7', surfaceStrong: '#EAF0FA', buttonText: '#FFFFFF',
            }),
        },
        'cotton-candy': {
            id: 'cotton-candy', label: 'Cotton Candy', description: 'Dreamy candy pink with a cool periwinkle lift.',
            tokens: {
                primary: '#F9A8D4', primaryHover: '#F472B6', primaryLight: '#FCE7F3', primaryDark: '#BE185D',
                accent: '#A5B4FC', accentSoft: 'rgba(249, 168, 212, 0.18)', background: '#160C1A', surface: '#2A1730', surfaceHover: '#432345', surfaceStrong: '#351D3A',
                border: 'rgba(249, 168, 212, 0.24)', textPrimary: '#FFF7FB', textSecondary: '#FCE7F3', textTertiary: '#F9A8D4',
                success: '#86EFAC', danger: '#FB7185', shadow: 'rgba(20, 4, 25, 0.64)', scrollbarThumb: 'rgba(249, 168, 212, 0.36)', scrollbarThumbHover: 'rgba(165, 180, 252, 0.64)', buttonText: '#3B1028',
            },
            lightTokens: createLightTokens({
                primary: '#DB2777', primaryHover: '#BE185D', primaryLight: '#F9A8D4', primaryDark: '#9D174D', accent: '#818CF8',
                background: '#FFF7FB', surface: '#FFFFFF', surfaceHover: '#FCE7F3', surfaceStrong: '#E0E7FF', buttonText: '#FFFFFF',
            }),
        },
        'rose-gold': {
            id: 'rose-gold', label: 'Rose Gold', description: 'Polished rose metal with a warm champagne glow.',
            tokens: {
                primary: '#F9A8D4', primaryHover: '#F472B6', primaryLight: '#FBCFE8', primaryDark: '#BE185D',
                accent: '#FDE68A', accentSoft: 'rgba(249, 168, 212, 0.18)', background: '#1A0D13', surface: '#34201F', surfaceHover: '#4C2B2A', surfaceStrong: '#402523',
                border: 'rgba(253, 186, 116, 0.23)', textPrimary: '#FFF7ED', textSecondary: '#FFEDD5', textTertiary: '#FDBA74',
                success: '#86EFAC', danger: '#FB7185', shadow: 'rgba(25, 7, 10, 0.64)', scrollbarThumb: 'rgba(249, 168, 212, 0.36)', scrollbarThumbHover: 'rgba(253, 230, 138, 0.64)', buttonText: '#421328',
            },
            lightTokens: createLightTokens({
                primary: '#BE185D', primaryHover: '#9D174D', primaryLight: '#F9A8D4', primaryDark: '#831843', accent: '#D97706',
                background: '#FFF7ED', surface: '#FFFFFF', surfaceHover: '#FCE7F3', surfaceStrong: '#FEF3C7', buttonText: '#FFFFFF',
            }),
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

    const LEGACY_THEME_MAP = { gold: 'default', rose: 'sakura', violet: 'violet', ocean: 'ocean', watermelon: 'obsidian', plum: 'ash-plum' };

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
