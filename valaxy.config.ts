import type { UserThemeConfig } from 'valaxy-theme-yun'
import { defineValaxyConfig } from 'valaxy'

// add icons what you will need
const safelist = [
  'i-ri-home-line',
]

/**
 * User Config
 */
export default defineValaxyConfig<UserThemeConfig>({
  // site config see site.config.ts

  theme: 'yun',

  themeConfig: {
    banner: {
      enable: true,
      title: '托奇玛的博客',
    },

    pages: [
      {
        name: '我的小伙伴们',
        url: '/links/',
        icon: 'i-ri-open-arm-line',
        color: 'dodgerblue',
      },
      {
        name: '分类',
        url: '/categories/',
        icon: 'i-ri-apps-line',
        color: 'dodgerblue',
      },
      {
        name: '标签',
        url: '/tags/',
        icon: 'i-ri-bookmark-3-line',
        color: 'dodgerblue',
      },

    ],
    colors: {
      primary: "#D69B54",
    },

    footer: {
      since: 2025,
      powered: true,
      beian: {
        enable: false,
        icp: '苏ICP备17038157号',
      },
    },
    fireworks: {  
      enable: true,
      colors: ['#FFE57D', '#FFCD88', '#E6F4AD']
    },
  },

  unocss: { safelist },
  siteConfig: {
    // 启用评论
    comment: {
      enable: true  //这里是评论的设置，如果你不需要评论，可以将enable改为false即可
    },
  },
  
})
