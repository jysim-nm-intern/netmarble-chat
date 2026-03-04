FROM rabbitmq:3.13-management

# STOMP 플러그인 활성화
RUN rabbitmq-plugins enable --offline rabbitmq_stomp

# Windows Docker Desktop 환경에서 .erlang.cookie 권한 문제 해결
RUN echo "netmarble-chat-cookie" > /var/lib/rabbitmq/.erlang.cookie && \
    chown rabbitmq:rabbitmq /var/lib/rabbitmq/.erlang.cookie && \
    chmod 600 /var/lib/rabbitmq/.erlang.cookie
