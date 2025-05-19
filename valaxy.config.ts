import type { UserThemeConfig } from 'valaxy-theme-yun'
import { defineValaxyConfig } from 'valaxy'

import { addonTwikoo } from 'valaxy-addon-twikoo'  //接入Twikoo评论系统

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
    bg_image: {
      enable: true,  //这里是背景图的设置，你可以设置白日模式和夜间模式的背景图，如果你不需要背景图，可以将上面的enable改为false即可
      url: "https://cdn.jsdelivr.net/gh/TorchMar/ImgHostServer@main/night.jpg",	// 白日模式背景
      dark: "https://cdn.jsdelivr.net/gh/TorchMar/ImgHostServer@main/day.jpg",	// 夜间模式背景
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
  addons: [
    addonTwikoo({
      envId: 'https://twikoo-torchmar.netlify.app/.netlify/functions/twikoo'
    }),
  ],
})
