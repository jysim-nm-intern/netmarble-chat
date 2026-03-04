FROM rabbitmq:3.13-management

# STOMP + Management 플러그인 선언적 활성화
COPY enabled_plugins /etc/rabbitmq/enabled_plugins

# Windows Docker Desktop 환경에서 .erlang.cookie 권한 문제 해결
RUN echo "netmarble-chat-cookie" > /var/lib/rabbitmq/.erlang.cookie && \
    chown rabbitmq:rabbitmq /var/lib/rabbitmq/.erlang.cookie && \
    chmod 600 /var/lib/rabbitmq/.erlang.cookie
