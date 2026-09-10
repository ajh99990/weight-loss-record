# 独立服务器部署

目标：`root@112.124.102.227`，访问地址：`http://112.124.102.227:8088/`。

容器 `daily-fuel`，映射 `8088:8080`，自动重启策略 `unless-stopped`。复用服务器已有的 OpenResty 镜像构建独立静态网站镜像，不修改 1Panel 现有网站配置。发布文件保存在 `/opt/daily-fuel/releases/`，其中 `current` 链接由部署过程维护，具体版本见服务器 `/opt/daily-fuel/DEPLOYMENT.txt`。

本机执行 `npm test` 和 `npm run build` 后，把 `dist/` 和 `deploy/` 上传到新的发布目录。在服务器发布目录内执行：

```sh
docker build --pull=false -f deploy/Dockerfile -t daily-fuel:RELEASE .
sh deploy/run.sh daily-fuel:RELEASE
```

`run.sh` 用于首次启动，不会覆盖已有同名容器。后续更新应先保留旧镜像与启动配置，再更换容器；出现异常时用旧镜像恢复。无需修改数据目录，饮食记录始终存在访问者浏览器中。

检查：

```sh
docker inspect daily-fuel --format '{{.State.Health.Status}}'
curl -f http://127.0.0.1:8088/healthz
docker logs --tail 50 daily-fuel
```

外部访问需要服务器防火墙和阿里云安全组允许 TCP 8088。当前 HTTP 访问已兼容缺少 `crypto.randomUUID` 的浏览器环境。

不同网址使用不同的浏览器本地存储：旧 Sites 网址上的记录不会自动出现在 IP 网址。网页本身公开可访问，但不会向服务器上传饮食记录。
