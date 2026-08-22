extends Area2D

# Simple coin script that notifies the GameManager when collected.

func _ready() -> void:
    connect("body_entered", self, "_on_body_entered")

func _on_body_entered(body: Node) -> void:
    if body.is_in_group("player"):
        # Increment score via the GameManager singleton
        if Engine.has_singleton("game_manager"):
            var gm = Engine.get_singleton("game_manager")
            gm.add_score(1)
        queue_free()
