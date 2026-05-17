// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PatientHealthAccessControl {

    address public admin;

    struct Provider { bool isRegistered; string name; }
    struct AccessPermission { bool granted; uint256 expiryTime; uint256 grantedAt; }

    mapping(address => Provider) public providers;
    mapping(uint256 => string) public scopes;
    uint256 public scopeCount;
    mapping(address => mapping(address => mapping(uint256 => AccessPermission))) private permissions;
    mapping(address => address) public emergencyContacts;
    mapping(address => mapping(uint256 => bytes32)) public dataHashes;

    event ProviderRegistered(address indexed provider, string name);
    event ProviderRemoved(address indexed provider);
    event ScopeAdded(uint256 indexed scopeId, string name);
    event AccessGranted(address indexed patient, address indexed provider, uint256 indexed scopeId, uint256 expiryTime);
    event AccessRevoked(address indexed patient, address indexed provider, uint256 indexed scopeId);
    event RecordAccessed(address indexed patient, address indexed provider, uint256 indexed scopeId, uint256 timestamp);
    event AccessDenied(address indexed patient, address indexed provider, uint256 indexed scopeId, string reason);
    event EmergencyContactSet(address indexed patient, address indexed emergencyContact);
    event EmergencyAccessUsed(address indexed patient, address indexed emergencyContact, uint256 indexed scopeId);
    event DataHashRegistered(address indexed patient, uint256 indexed scopeId, bytes32 dataHash);

    modifier onlyAdmin() { require(msg.sender == admin, "Only Super Admin can do this"); _; }
    modifier onlyRegisteredProvider() { require(providers[msg.sender].isRegistered, "Caller is not a registered provider"); _; }
    modifier validScope(uint256 _scopeId) { require(_scopeId >= 1 && _scopeId <= scopeCount, "Invalid scope ID"); _; }

    constructor() {
        admin = msg.sender;
        _addScope("HIV Status");
        _addScope("Mental Health Records");
        _addScope("Gender Identity");
        _addScope("General Medical History");
        _addScope("Prescription Records");
    }

    function registerProvider(address _provider, string calldata _name) external onlyAdmin { require(_provider != address(0), "Invalid"); require(!providers[_provider].isRegistered, "Already registered"); providers[_provider] = Provider(true, _name); emit ProviderRegistered(_provider, _name); }
    function removeProvider(address _provider) external onlyAdmin { require(providers[_provider].isRegistered, "Not registered"); providers[_provider].isRegistered = false; emit ProviderRemoved(_provider); }
    function addScope(string calldata _name) external onlyAdmin { _addScope(_name); }
    function _addScope(string memory _name) internal { scopeCount++; scopes[scopeCount] = _name; emit ScopeAdded(scopeCount, _name); }

    function grantAccess(address _provider, uint256 _scopeId, uint256 _durationSecs) external validScope(_scopeId) { require(providers[_provider].isRegistered, "Provider not registered"); require(_provider != msg.sender, "Cannot grant to self"); require(_durationSecs > 0, "Duration must be > 0"); uint256 expiry = block.timestamp + _durationSecs; permissions[msg.sender][_provider][_scopeId] = AccessPermission(true, expiry, block.timestamp); emit AccessGranted(msg.sender, _provider, _scopeId, expiry); }
    function grantAccessBatch(address _provider, uint256[] calldata _scopeIds, uint256 _durationSecs) external { require(providers[_provider].isRegistered, "Not registered"); require(_provider != msg.sender, "Cannot grant to self"); require(_durationSecs > 0, "Duration > 0"); uint256 expiry = block.timestamp + _durationSecs; for (uint256 i = 0; i < _scopeIds.length; i++) { uint256 sid = _scopeIds[i]; require(sid >= 1 && sid <= scopeCount, "Invalid scope"); permissions[msg.sender][_provider][sid] = AccessPermission(true, expiry, block.timestamp); emit AccessGranted(msg.sender, _provider, sid, expiry); } }
    function revokeAccess(address _provider, uint256 _scopeId) external validScope(_scopeId) { permissions[msg.sender][_provider][_scopeId].granted = false; emit AccessRevoked(msg.sender, _provider, _scopeId); }
    function revokeAllAccess(address _provider) external { for (uint256 i = 1; i <= scopeCount; i++) { if (permissions[msg.sender][_provider][i].granted) { permissions[msg.sender][_provider][i].granted = false; emit AccessRevoked(msg.sender, _provider, i); } } }
    function setEmergencyContact(address _contact) external { require(_contact != address(0), "Invalid"); require(_contact != msg.sender, "Cannot be own contact"); emergencyContacts[msg.sender] = _contact; emit EmergencyContactSet(msg.sender, _contact); }
    function registerDataHash(uint256 _scopeId, bytes32 _hash) external validScope(_scopeId) { dataHashes[msg.sender][_scopeId] = _hash; emit DataHashRegistered(msg.sender, _scopeId, _hash); }
    function checkAccess(address _patient, uint256 _scopeId) public view validScope(_scopeId) returns (bool) { AccessPermission memory p = permissions[_patient][msg.sender][_scopeId]; if (!p.granted) return false; if (p.expiryTime != 0 && block.timestamp > p.expiryTime) return false; return true; }
    function accessRecord(address _patient, uint256 _scopeId) external onlyRegisteredProvider validScope(_scopeId) returns (string memory) { if (!checkAccess(_patient, _scopeId)) { emit AccessDenied(_patient, msg.sender, _scopeId, "No valid permission"); revert("Access denied"); } emit RecordAccessed(_patient, msg.sender, _scopeId, block.timestamp); return "Access granted"; }
    function emergencyAccessRecord(address _patient, uint256 _scopeId) external validScope(_scopeId) returns (string memory) { require(emergencyContacts[_patient] == msg.sender, "Not emergency contact"); emit EmergencyAccessUsed(_patient, msg.sender, _scopeId); return "Emergency access granted"; }
    function getPermission(address _patient, address _provider, uint256 _scopeId) external view returns (bool granted, uint256 expiryTime, uint256 grantedAt) { AccessPermission memory p = permissions[_patient][_provider][_scopeId]; return (p.granted, p.expiryTime, p.grantedAt); }
    function verifyDataHash(address _patient, uint256 _scopeId, bytes32 _hash) external view validScope(_scopeId) returns (bool) { return dataHashes[_patient][_scopeId] == _hash; }
}
