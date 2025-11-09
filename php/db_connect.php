<?php
header('Content-Type: application/json');

$server = "localhost";
$username = "root";
$password = "Pushparaj$65";
$database = "pixsoul";

$con = mysqli_connect($server, $username, $password, $database);

if (!$con) {
    echo json_encode(["success" => false, "error" => mysqli_connect_error()]);
    exit;
}

if (!isset($_GET['query'])) {
    echo json_encode(["success" => false, "error" => "No query provided"]);
    exit;
}

$sql = $_GET['query'];
$result = mysqli_query($con, $sql);

if (!$result) {
    echo json_encode(["success" => false, "error" => mysqli_error($con)]);
    exit;
}

$data = [];
if ($result !== true) {
    while ($row = mysqli_fetch_assoc($result)) {
        $data[] = $row;
    }
}

echo json_encode(["success" => true, "data" => $data]);
mysqli_close($con);
?>
