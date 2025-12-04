# This is free software, licensed under the GNU General Public License v2.
# 智淀导航 OpenWrt 安装程序

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-zdinnav
LUCI_TITLE:=LuCI zdinnav app
LUCI_DESCRIPTION:=ZdinNav - Private Network Bookmark Management Tool.
LUCI_DEPENDS:=+luci-base +lsblk +docker
LUCI_PKGARCH:=all
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

PKG_MAINTAINER:=tkme <tkme@qq.com>

define Package/luci-app-zdinnav/conffiles
/etc/config/zdinnav
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature