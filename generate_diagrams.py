"""
Generate detailed architecture diagrams for the Pictionary project.

Requirements:
  pip install diagrams
  Graphviz installed and available in PATH

Usage:
  python generate_diagrams.py

Outputs:
  diagrams/pictionary_architecture.png
  diagrams/pictionary_round_flow.png
"""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.onprem.client import Users
from diagrams.onprem.compute import Server
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.network import Nginx
from diagrams.programming.language import Nodejs, Typescript


OUTPUT_DIR = Path("diagrams")


def generate_architecture_diagram() -> None:
    graph_attr = {
        "pad": "0.2",
        "nodesep": "0.35",
        "ranksep": "0.45",
        "splines": "ortho",
        "fontname": "Helvetica",
        "fontsize": "11",
        "labeljust": "l",
    }
    node_attr = {
        "fontsize": "10",
    }
    edge_attr = {
        "fontsize": "9",
    }

    with Diagram(
        "Pictionary Architecture (Detailed)",
        filename=str(OUTPUT_DIR / "pictionary_architecture"),
        show=False,
        direction="LR",
        graph_attr=graph_attr,
        node_attr=node_attr,
        edge_attr=edge_attr,
        outformat=["png", "svg"],
    ):
        with Cluster("Client Layer (Browser Tabs)"):
            players = Users("Host + Guessers")
            ui = Typescript("UIController\nscreen/forms/theme/scores")
            client = Typescript("GameClient\nsocket events + room sync")
            canvas = Typescript("DrawingCanvas\nstrokes + snapshot sync")
            dom = Server("index.html + styles.css")
            state = Server("sessionStorage/localStorage\nplayerName/theme/sessionToken")

            players >> ui
            ui >> dom
            ui >> client
            ui >> canvas
            ui >> state
            canvas >> Edge(label="drawCommand\n(snapshot fallback)", color="blue") >> client

        with Cluster("Frontend Hosting"):
            dev_server = Nginx("Webpack Dev Server :8087")
            static_host = Server("Static Bundle Host")
            proxy = Nginx("Proxy\n/socket.io + /api")
            dev_server >> proxy

        with Cluster("Backend (Node + Socket.IO)"):
            express = Nodejs("Express + HTTP")
            socket = Nodejs("Socket.IO Gateway")
            auth = Nodejs("authMiddleware\njwt/anon identity")
            with Cluster("Realtime Core"):
                game_handler = Nodejs("gameHandler\nroom lifecycle")
                round_engine = Nodejs("round engine\nstartRound/endRound")
                scoring = Nodejs("guess validator + scoring")
                reconnect = Nodejs("reconnect recovery")
                game_handler >> round_engine
                game_handler >> scoring
                game_handler >> reconnect
            with Cluster("Services"):
                word_service = Nodejs("wordService")
                leaderboard_service = Nodejs("leaderboardService")
            env = Server(".env/config\nPORT/REDIS_URL/\nDATABASE_URL/JWT_SECRET")

            express >> socket >> auth >> game_handler
            round_engine >> word_service
            scoring >> leaderboard_service
            env >> express

        with Cluster("Data Layer"):
            redis = Redis("Redis")
            redis_keys = Server(
                "Keys:\nroom:*\ngame:*\ndrawing:*"
                "\nsession:*\nleaderboard"
            )
            postgres = PostgreSQL("PostgreSQL\n(persistent records)")

            redis >> redis_keys

        client >> Edge(
            label="WebSocket\ncreateRoom/joinRoom/startGame\n"
            "drawCommand/makeGuess/playerReconnect",
            color="darkgreen",
            penwidth="2",
        ) >> socket

        socket >> Edge(
            label="roomUpdate/roundStart/gameState/\n"
            "drawingSync/yourWord/guessResult/gameEnd",
            color="darkgreen",
            penwidth="2",
        ) >> client

        client >> Edge(label="HTTP + WS", style="dashed") >> dev_server
        proxy >> Edge(label="upstream proxy", style="dashed") >> express
        static_host >> express

        game_handler >> Edge(
            label="state reads/writes,\ndrawing history,\nsession tokens",
            color="orange",
        ) >> redis
        reconnect >> Edge(label="session mapping", color="orange") >> redis
        leaderboard_service >> Edge(label="leaderboard updates", color="orange") >> redis
        leaderboard_service >> Edge(label="optional persistence", color="brown") >> postgres


def generate_round_flow_diagram() -> None:
    graph_attr = {
        "pad": "0.2",
        "nodesep": "0.35",
        "ranksep": "0.45",
        "splines": "ortho",
        "fontname": "Helvetica",
        "fontsize": "11",
    }
    node_attr = {"fontsize": "10"}
    edge_attr = {"fontsize": "9"}

    with Diagram(
        "Pictionary Round Flow (Realtime)",
        filename=str(OUTPUT_DIR / "pictionary_round_flow"),
        show=False,
        direction="LR",
        graph_attr=graph_attr,
        node_attr=node_attr,
        edge_attr=edge_attr,
        outformat=["png", "svg"],
    ):
        with Cluster("Actors"):
            host = Users("Host/Drawer")
            guessers = Users("Guessers")

        with Cluster("Realtime Engine"):
            socket = Nodejs("Socket.IO")
            handler = Nodejs("gameHandler")
            timer = Nodejs("round timer tick")
            score = Nodejs("guess check + scoring")
            socket >> handler
            handler >> timer
            handler >> score

        with Cluster("State"):
            redis = Redis("Redis")
            keys = Server("room/game/drawing/\nsession/leaderboard keys")
            redis >> keys

        start = Server("1) Host starts game")
        select = Server("2) select drawer + word + round time")
        emit = Server("3) emit roundStart + yourWord")
        draw = Server("4) host sends drawCommand + snapshot")
        relay = Server("5) relay drawingSync to room")
        guess = Server("6) guessers send makeGuess")
        update = Server("7) emit guessResult/gameState")
        end = Server("8) nextRound or gameEnd")

        host >> start >> socket
        socket >> handler >> select >> emit >> socket
        host >> draw >> socket >> relay >> guessers
        guessers >> guess >> socket >> score >> update >> socket
        timer >> update
        update >> host
        update >> guessers
        score >> end
        handler >> Edge(label="state reads/writes", color="orange") >> redis


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generate_architecture_diagram()
    generate_round_flow_diagram()
    print(f"Generated diagrams in: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
