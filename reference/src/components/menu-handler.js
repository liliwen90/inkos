// menu-handler.js - 侧栏菜单导航
(function() {
    const menuItems = document.querySelectorAll('.menu-item');
    const pages = document.querySelectorAll('.page');

    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetPage = this.getAttribute('data-page');

            // 更新菜单激活状态
            menuItems.forEach(mi => mi.classList.remove('active'));
            this.classList.add('active');

            // 切换页面
            pages.forEach(page => page.classList.remove('active'));
            const target = document.getElementById('page-' + targetPage);
            if (target) target.classList.add('active');
        });
    });
})();
