<?php
header('Content-Type: application/json');
$lat = $_GET['lat'] ?? '';
$lng = $_GET['lng'] ?? '';
if (!$lat || !$lng) {
  echo json_encode(['error' => 'Missing coordinates']);
  exit;
}
$apiKey = ' ea036165e0f14b4bb98e7a5be8099e13';
$url = "https://api.opencagedata.com/geocode/v1/json?q=$lat+$lng&key=$apiKey";

$response = file_get_contents($url);
if ($response === false) {
  echo json_encode(['error' => 'API request failed']);
  exit;
}
$data = json_decode($response, true);
echo json_encode($data);
