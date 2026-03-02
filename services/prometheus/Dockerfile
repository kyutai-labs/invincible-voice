FROM prom/prometheus:v2.45.0

ARG CONFIG_FILE=prometheus.yml
COPY ${CONFIG_FILE} /etc/prometheus/prometheus.yml

CMD ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.path=/prometheus"]