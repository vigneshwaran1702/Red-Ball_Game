extends Node2D

# This script can be expanded for level logic (spawning, score handling, etc.)
# For now it just sets up basic references.

func _ready() -> void:
    # Ensure the player node is in the 'player' group for coin detection
    var player = $PlayerInstance
    if player:
        player.add_to_group("player")
    var enemy = $EnemyInstance
    if enemy:
        enemy.add_to_group("enemy")
    var coin = $CoinInstance
    if coin:
        coin.add_to_group("coin")
