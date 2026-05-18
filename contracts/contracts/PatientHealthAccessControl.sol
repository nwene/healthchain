// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// PatientHealthAccessControl
// Patient-controlled access management for sensitive health records.
// The contract stores permissions, provider registration status, emergency contacts,
//     and plaintext document hash anchors. Medical data and files stay off-chain.
contract PatientHealthAccessControl {
    // Super admin address. This is the deployer and the only account that can manage providers/scopes.
    address public admin;

    // Basic provider registry metadata.
    // isRegistered: Whether the provider is registered on-chain by the super admin.
    // name: Human-readable provider or hospital name.
    struct Provider {
        bool isRegistered;
        string name;
    }

    // Access permission for one patient, one provider, and one scope.
    // granted: Whether access is currently enabled.
    // expiryTime: Unix timestamp when access expires.
    // grantedAt: Unix timestamp when access was last granted.
    struct AccessPermission {
        bool granted;
        uint256 expiryTime;
        uint256 grantedAt;
    }

    // Provider registry keyed by provider wallet address.
    mapping(address => Provider) public providers;

    // Scope registry, where each numeric scope maps to a sensitive health data category.
    mapping(uint256 => string) public scopes;

    // Total number of scopes registered in the contract.
    uint256 public scopeCount;

    // Core permission store: patient => provider => scopeId => permission.
    mapping(address => mapping(address => mapping(uint256 => AccessPermission))) private permissions;

    // Emergency contact configured by each patient.
    mapping(address => address) public emergencyContacts;

    // SHA-256 document/data anchors: patient => scopeId => plaintext hash.
    mapping(address => mapping(uint256 => bytes32)) public dataHashes;

    // Emitted when the super admin registers a provider on-chain.
    event ProviderRegistered(address indexed provider, string name);

    // Emitted when the super admin removes provider registration.
    event ProviderRemoved(address indexed provider);

    // Emitted when the super admin creates a new health data scope.
    event ScopeAdded(uint256 indexed scopeId, string name);

    // Emitted when a patient grants provider access to one scope.
    event AccessGranted(address indexed patient, address indexed provider, uint256 indexed scopeId, uint256 expiryTime);

    // Emitted when a patient revokes provider access to one scope.
    event AccessRevoked(address indexed patient, address indexed provider, uint256 indexed scopeId);

    // Emitted when a registered provider successfully accesses an approved record scope.
    event RecordAccessed(address indexed patient, address indexed provider, uint256 indexed scopeId, uint256 timestamp);

    // Emitted before reverting when a provider tries to access a scope without valid permission.
    event AccessDenied(address indexed patient, address indexed provider, uint256 indexed scopeId, string reason);

    // Emitted when a patient sets or changes their emergency contact.
    event EmergencyContactSet(address indexed patient, address indexed emergencyContact);

    // Emitted when the patient's emergency contact uses emergency access.
    event EmergencyAccessUsed(address indexed patient, address indexed emergencyContact, uint256 indexed scopeId);

    // Emitted when a patient anchors a plaintext data hash for a scope.
    event DataHashRegistered(address indexed patient, uint256 indexed scopeId, bytes32 dataHash);

    // Restricts sensitive operations to the deployer/super admin.
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only Super Admin can do this");
        _;
    }

    // Ensures the caller is a provider registered by the super admin.
    modifier onlyRegisteredProvider() {
        require(providers[msg.sender].isRegistered, "Caller is not a registered provider");
        _;
    }

    // Ensures the scope exists before reading or writing scope-specific state.
    modifier validScope(uint256 _scopeId) {
        require(_scopeId >= 1 && _scopeId <= scopeCount, "Invalid scope ID");
        _;
    }

    // Sets the deployer as super admin and creates the default sensitive health scopes.
    constructor() {
        admin = msg.sender;
        _addScope("HIV Status");
        _addScope("Mental Health Records");
        _addScope("Gender Identity");
        _addScope("General Medical History");
        _addScope("Prescription Records");
    }

    // Register a verified healthcare provider on-chain.
    // Backend approval is separate; this function is the blockchain-side provider registration.
    // _provider: Provider wallet address.
    // _name: Human-readable provider or hospital name.
    function registerProvider(address _provider, string calldata _name) external onlyAdmin {
        require(_provider != address(0), "Invalid");
        require(!providers[_provider].isRegistered, "Already registered");

        providers[_provider] = Provider(true, _name);
        emit ProviderRegistered(_provider, _name);
    }

    // Remove a provider from the on-chain registry.
    // _provider: Provider wallet address to remove.
    function removeProvider(address _provider) external onlyAdmin {
        require(providers[_provider].isRegistered, "Not registered");

        providers[_provider].isRegistered = false;
        emit ProviderRemoved(_provider);
    }

    // Add a new health data scope.
    // _name: Human-readable scope name.
    function addScope(string calldata _name) external onlyAdmin {
        _addScope(_name);
    }

    // Internal scope creation helper used by the constructor and addScope.
    function _addScope(string memory _name) internal {
        scopeCount++;
        scopes[scopeCount] = _name;
        emit ScopeAdded(scopeCount, _name);
    }

    // Grant a registered provider time-limited access to one scope.
    // _provider: Provider wallet address receiving access.
    // _scopeId: Health data scope ID.
    // _durationSecs: Access duration in seconds.
    function grantAccess(address _provider, uint256 _scopeId, uint256 _durationSecs) external validScope(_scopeId) {
        require(providers[_provider].isRegistered, "Provider not registered");
        require(_provider != msg.sender, "Cannot grant to self");
        require(_durationSecs > 0, "Duration must be > 0");

        uint256 expiry = block.timestamp + _durationSecs;
        permissions[msg.sender][_provider][_scopeId] = AccessPermission(true, expiry, block.timestamp);
        emit AccessGranted(msg.sender, _provider, _scopeId, expiry);
    }

    // Grant a registered provider time-limited access to multiple scopes.
    // _provider: Provider wallet address receiving access.
    // _scopeIds: Health data scope IDs.
    // _durationSecs: Access duration in seconds.
    function grantAccessBatch(address _provider, uint256[] calldata _scopeIds, uint256 _durationSecs) external {
        require(providers[_provider].isRegistered, "Not registered");
        require(_provider != msg.sender, "Cannot grant to self");
        require(_durationSecs > 0, "Duration > 0");

        uint256 expiry = block.timestamp + _durationSecs;

        for (uint256 i = 0; i < _scopeIds.length; i++) {
            uint256 sid = _scopeIds[i];
            require(sid >= 1 && sid <= scopeCount, "Invalid scope");

            permissions[msg.sender][_provider][sid] = AccessPermission(true, expiry, block.timestamp);
            emit AccessGranted(msg.sender, _provider, sid, expiry);
        }
    }

    // Revoke one provider's access to one scope.
    // _provider: Provider wallet address losing access.
    // _scopeId: Health data scope ID.
    function revokeAccess(address _provider, uint256 _scopeId) external validScope(_scopeId) {
        permissions[msg.sender][_provider][_scopeId].granted = false;
        emit AccessRevoked(msg.sender, _provider, _scopeId);
    }

    // Revoke all currently granted scopes for one provider.
    // _provider: Provider wallet address losing access.
    function revokeAllAccess(address _provider) external {
        for (uint256 i = 1; i <= scopeCount; i++) {
            if (permissions[msg.sender][_provider][i].granted) {
                permissions[msg.sender][_provider][i].granted = false;
                emit AccessRevoked(msg.sender, _provider, i);
            }
        }
    }

    // Set an emergency contact that can use emergency access.
    // _contact: Emergency contact wallet address.
    function setEmergencyContact(address _contact) external {
        require(_contact != address(0), "Invalid");
        require(_contact != msg.sender, "Cannot be own contact");

        emergencyContacts[msg.sender] = _contact;
        emit EmergencyContactSet(msg.sender, _contact);
    }

    // Anchor the SHA-256 plaintext hash for a patient's scope data.
    // This stores only the hash, not the medical data.
    // _scopeId: Health data scope ID.
    // _hash: SHA-256 hash of the plaintext data or document.
    function registerDataHash(uint256 _scopeId, bytes32 _hash) external validScope(_scopeId) {
        dataHashes[msg.sender][_scopeId] = _hash;
        emit DataHashRegistered(msg.sender, _scopeId, _hash);
    }

    // Check whether the caller has active, unexpired access to a patient's scope.
    // _patient: Patient wallet address.
    // _scopeId: Health data scope ID.
    // True: when access is granted and not expired.
    function checkAccess(address _patient, uint256 _scopeId) public view validScope(_scopeId) returns (bool) {
        AccessPermission memory p = permissions[_patient][msg.sender][_scopeId];
        if (!p.granted) return false;
        if (p.expiryTime != 0 && block.timestamp > p.expiryTime) return false;
        return true;
    }

    // Record a provider access event after confirming permission.
    // The returned string is only a signal; the real data remains off-chain in the backend.
    // _patient: Patient wallet address.
    // _scopeId: Health data scope ID.
    // Confirmation: message.
    function accessRecord(address _patient, uint256 _scopeId)
        external
        onlyRegisteredProvider
        validScope(_scopeId)
        returns (string memory)
    {
        if (!checkAccess(_patient, _scopeId)) {
            emit AccessDenied(_patient, msg.sender, _scopeId, "No valid permission");
            revert("Access denied");
        }

        emit RecordAccessed(_patient, msg.sender, _scopeId, block.timestamp);
        return "Access granted";
    }

    // Record emergency access for a patient's designated emergency contact.
    // _patient: Patient wallet address.
    // _scopeId: Health data scope ID.
    // Confirmation: message.
    function emergencyAccessRecord(address _patient, uint256 _scopeId) external validScope(_scopeId) returns (string memory) {
        require(emergencyContacts[_patient] == msg.sender, "Not emergency contact");

        emit EmergencyAccessUsed(_patient, msg.sender, _scopeId);
        return "Emergency access granted";
    }

    // Read full permission details for a patient/provider/scope tuple.
    // _patient: Patient wallet address.
    // _provider: Provider wallet address.
    // _scopeId: Health data scope ID.
    // granted: Whether access is currently granted.
    // expiryTime: Unix timestamp when access expires.
    // grantedAt: Unix timestamp when access was granted.
    function getPermission(address _patient, address _provider, uint256 _scopeId)
        external
        view
        returns (bool granted, uint256 expiryTime, uint256 grantedAt)
    {
        AccessPermission memory p = permissions[_patient][_provider][_scopeId];
        return (p.granted, p.expiryTime, p.grantedAt);
    }

    // Verify that a supplied plaintext hash matches the hash anchored for a patient's scope.
    // _patient: Patient wallet address.
    // _scopeId: Health data scope ID.
    // _hash: SHA-256 plaintext hash to verify.
    // True: when the supplied hash matches the stored hash.
    function verifyDataHash(address _patient, uint256 _scopeId, bytes32 _hash)
        external
        view
        validScope(_scopeId)
        returns (bool)
    {
        return dataHashes[_patient][_scopeId] == _hash;
    }
}
