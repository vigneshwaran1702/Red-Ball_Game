extends Control

func _ready() -> void:
    var start_button = $StartButton
    if start_button:
        start_button.connect("pressed", self, "_on_start_pressed")

func _on_start_pressed() -> void:
    var level_scene = load("res://scenes/Level01.tscn")
    get_tree().change_scene_to_packed(level_scene)
