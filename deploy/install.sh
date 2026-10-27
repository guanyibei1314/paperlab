#!/usr/bin/env bash
# 纸上实验室：在一台 Linux 服务器上一键部署（Ubuntu / Debian / CentOS / OpenCloudOS 等）
#
# 用法（以 root 身份在服务器上运行）：
#   bash install.sh                          # 从 GitHub 下载最新版网站
#   bash install.sh /root/paperlab-site.zip  # 使用你上传到服务器上的网站包
#   DOMAIN=physics.example.cn bash install.sh   # 同时绑定域名（可选，域名需已备案）
#
# 以后更新网站：重新运行同一条命令即可，旧版本会保留在 /var/www/paperlab.old
set -euo pipefail

WEBROOT=/var/www/paperlab
SRC="${1:-}"
DOMAIN="${DOMAIN:-_}"
REPO_TAR="https://github.com/guanyibei1314/paperlab/archive/refs/heads/main.tar.gz"
HERE="$(cd "$(dirname "$0")" && pwd)"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
pkg() {
  if have apt-get; then DEBIAN_FRONTEND=noninteractive apt-get update -y -q && DEBIAN_FRONTEND=noninteractive apt-get install -y -q "$@"
  elif have dnf; then dnf install -y -q "$@"
  elif have yum; then yum install -y -q "$@"
  else echo "无法识别的系统，请先手动安装：$*"; exit 1; fi
}

[ "$(id -u)" = 0 ] || { echo "请用 root 运行（前面加 sudo）"; exit 1; }

say "1/4 检查 nginx、unzip、curl"
have nginx || pkg nginx
have unzip || pkg unzip
have curl || pkg curl

say "2/4 准备网站文件"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if [ -n "$SRC" ]; then
  unzip -q "$SRC" -d "$TMP/site"
else
  curl -fL --retry 3 --connect-timeout 20 -o "$TMP/main.tar.gz" "$REPO_TAR" || {
    echo "从 GitHub 下载失败（国内服务器连 GitHub 有时不稳定）。"
    echo "请把 paperlab-site.zip 上传到服务器，再运行：bash install.sh /root/paperlab-site.zip"
    exit 1
  }
  tar xzf "$TMP/main.tar.gz" -C "$TMP"
  mv "$TMP"/paperlab-main/site "$TMP/site"
fi
[ -f "$TMP/site/index.html" ] || { echo "网站包里没有 index.html，请检查文件"; exit 1; }

say "3/4 安装到 $WEBROOT"
rm -rf "$WEBROOT.new" && cp -r "$TMP/site" "$WEBROOT.new"
if [ -d "$WEBROOT" ]; then rm -rf "$WEBROOT.old" && mv "$WEBROOT" "$WEBROOT.old"; fi
mv "$WEBROOT.new" "$WEBROOT"
chmod -R a+rX "$WEBROOT"

say "4/4 配置 nginx"
CONF_SRC="$HERE/nginx-paperlab.conf"
if [ ! -f "$CONF_SRC" ]; then CONF_SRC="$TMP/nginx-paperlab.conf"; curl -fsSL -o "$CONF_SRC" "https://raw.githubusercontent.com/guanyibei1314/paperlab/main/deploy/nginx-paperlab.conf"; fi
mkdir -p /etc/nginx/conf.d
sed "s/__DOMAIN__/$DOMAIN/" "$CONF_SRC" > /etc/nginx/conf.d/paperlab.conf
# 有的云服务器关闭了 IPv6，此时去掉 IPv6 监听，否则 nginx 起不来
if [ ! -f /proc/net/if_inet6 ]; then sed -i '/listen \[::\]:80/d' /etc/nginx/conf.d/paperlab.conf; fi
# Debian/Ubuntu 自带的默认站点会占用 80 端口，先停用（保留备份）
if [ -e /etc/nginx/sites-enabled/default ]; then mv /etc/nginx/sites-enabled/default /etc/nginx/default-site.disabled; fi
# CentOS 系列 nginx.conf 里自带的 default_server 也会冲突
if grep -q "default_server" /etc/nginx/nginx.conf 2>/dev/null; then sed -i.bak 's/ default_server//g' /etc/nginx/nginx.conf; fi
nginx -t
if have systemctl && systemctl is-system-running >/dev/null 2>&1; then
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl restart nginx
else
  nginx -s reload 2>/dev/null || nginx
fi

IP="$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
say "完成！"
echo "用浏览器打开：http://${IP}/"
[ "$DOMAIN" != "_" ] && echo "绑定的域名：http://${DOMAIN}/（域名解析需指向这台服务器）"
echo "提示：离线缓存功能需要 HTTPS。给域名申请好 SSL 证书后，可用：certbot --nginx -d 你的域名"
echo "别忘了在云服务器控制台的防火墙里放行 80（和 443）端口。"
