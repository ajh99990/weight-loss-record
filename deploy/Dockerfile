# Reuse the image already installed on the target server; no external pull needed.
FROM 1panel/openresty:1.21.4.3-3-3-focal
COPY deploy/nginx.conf /usr/local/openresty/nginx/conf/nginx.conf
COPY dist/ /srv/fuel/
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1
CMD ["/usr/local/openresty/bin/openresty", "-g", "daemon off;"]
