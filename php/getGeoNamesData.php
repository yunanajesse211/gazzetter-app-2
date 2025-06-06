<?php
header('Content-Type: application/json');

$type = $_GET['type'] ?? '';
$countryCode = $_GET['code'] ?? '';

if (!$type || !$countryCode) {
  echo json_encode([]);
  exit;
}

$username = 'emma2025';

function fetchJSON($url) {
  $opts = [
    "http" => ["header" => "User-Agent: gazetteer-app/1.0\r\n"]
  ];
  $context = stream_context_create($opts);
  $data = file_get_contents($url, false, $context);
  return $data ? json_decode($data, true) : [];
}

switch ($type) {
  case 'airports':
    $url = "http://api.geonames.org/searchJSON?country=$countryCode&featureClass=S&featureCode=AIRP&maxRows=1000&username=$username";
    $json = fetchJSON($url);
    $airports = [];
    foreach ($json['geonames'] ?? [] as $ap) {
      $name = strtolower($ap['name']);
      if (str_contains($name, 'international') || str_contains($name, 'intl') || str_contains($name, 'airport')) {
        $airports[] = [
          'name' => $ap['name'],
          'lat' => floatval($ap['lat']),
          'lng' => floatval($ap['lng']),
        ];
      }
    }
    $airports = array_slice($airports, 0, 30);
    echo json_encode($airports);
    break;
  case 'cities':
    $cities = [];
    $featureCodes = ['PPLA', 'PPLA2', 'PPLC'];
    foreach ($featureCodes as $code) {
      $url = "http://api.geonames.org/searchJSON?country=$countryCode&featureClass=P&featureCode=$code&maxRows=500&username=$username";
      $json = fetchJSON($url);
      foreach ($json['geonames'] ?? [] as $ct) {
        $cities[] = [
          'name' => $ct['name'],
          'lat' => floatval($ct['lat']),
          'lng' => floatval($ct['lng']),
        ];
      }
    }
    $cities = array_slice($cities, 0, 40);
    echo json_encode($cities);
    break;

  case 'earthquakes':
    $countryInfoUrl = "http://api.geonames.org/countryInfoJSON?country=$countryCode&username=$username";
    $countryInfo = fetchJSON($countryInfoUrl);

    if (empty($countryInfo['geonames'][0])) {
      echo json_encode([]); exit;
    }

    $bbox = $countryInfo['geonames'][0];
    $north = $bbox['north'];
    $south = $bbox['south'];
    $east = $bbox['east'];
    $west = $bbox['west'];

    $quakeData = fetchJSON("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson");
    $quakes = [];

    foreach ($quakeData['features'] ?? [] as $eq) {
      $props = $eq['properties'];
      $coords = $eq['geometry']['coordinates'];
      $lat = $coords[1];
      $lng = $coords[0];
      $depth = round($coords[2], 1);
      $mag = $props['mag'];
      $time = $props['time'];

      if ($lat <= $north && $lat >= $south && $lng <= $east && $lng >= $west) {
        $quakes[] = [
          'lat' => $lat,
          'lng' => $lng,
          'depth' => $depth,
          'magnitude' => $mag,
          'time' => $time
        ];
      }
    }
    usort($quakes, fn($a, $b) => $b['time'] <=> $a['time']);
    $quakes = array_slice($quakes, 0, 20);
    foreach ($quakes as &$q) {
      unset($q['time']);
    }
    echo json_encode($quakes);
    break;
  default:
    echo json_encode([]);
}
?>
