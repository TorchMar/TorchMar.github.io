import { defineSiteConfig } from 'valaxy'

export default defineSiteConfig({
  url: 'https://valaxy.site/',
  lang: 'zh-CN',
  title: 'TorchMar\'s Blog',
  subtitle:'Here is what I am thinking',
  author: {
    name: 'TorchMar',
    avatar:"https://cdn.jsdelivr.net/gh/TorchMar/ImgHostServer@main/Ray.jpg",
    status: {
      emoji: '💛' // 头像旁边的emoji
    },
  },
  favicon: 'https://cdn.jsdelivr.net/gh/TorchMar/ImgHostServer@main/favicon.ico',
  description: 'Always exploring, always learning.',
  social: [
    {
      name: 'RSS',
      link: '/atom.xml',
      icon: 'i-ri-rss-line',
      color: 'orange',
    },
    {
      name: 'GitHub',
      link: 'https://github.com/TorchMar',
      icon: 'i-ri-github-line',
      color: '#6e5494',
    },
    {
      name: '知乎',
      link: 'https://www.zhihu.com/people/dereeca',
      icon: 'i-ri-zhihu-line',
      color: '#0084FF',
    },
    {
      name: 'E-Mail',
      link: 'mailto:torchmar@sjtu.edu.cn',
      icon: 'i-ri-mail-line',
      color: '#8E71C1',
    },
  ],

  timezone: 'Asia/Shanghai',
  frontmatter: {
    time_warning: false,
  },
  codeHeightLimit: 300,
  mediumZoom: { enable: true },
  
  search: {
    enable: true,
  },
  comment: {
      enable: true
    },
  statistics: {
      enable: true,
      readTime: {
        /**
         * 阅读速度
         */
        speed: {
          cn: 300,
          en: 200,
        },
      },
    },

})
