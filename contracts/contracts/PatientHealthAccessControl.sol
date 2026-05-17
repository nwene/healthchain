// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PatientHealthAccessControl
/// @notice Patient-controlled access management for sensitive health records.
/// @dev The contract stores permissions, provider registration status, emergency contacts,
///      and plaintext document hash anchors. Medical data and files stay off-chain.
contract PatientHealthAccessControl {
    /// @notice Super admin address. This is the deployer and the only account that can manage providers/scopes.
    address public admin;

    /// @notice Basic provider registry metadata.
    /// @param isRegistered Whether the provider is registered on-chain by the super admin.
    /// @param name Human-readable provider or hospital name.
    struct Provider {
        bool isRegistered;
        string name;
    }

    /// @notice Access permission for one patient, one provider, and one scope.
    /// @param granted Whether access is currently enabled.
    /// @param expiryTime Unix timestamp when access expires.
    /// @param grantedAt Unix timestamp when access was last granted.
    struct AccessPermission {
        bool granted;
        uint256 expiryTime;
        uint256 grantedAt;
    }

    /// @notice Provider registry keyed by provider wallet address.
    mapping(address => Provider) public providers;

    /// @notice Scope registry, where each numeric scope maps to a sensitive health data category.
    mapping(uint256 => string) public scopes;

    /// @notice Total number of scopes registered in the contract.
    uint256 public scopeCount;

    /// @dev Core permission store: patient => provider => scopeId => permission.
    mapping(address => mapping(address => mapping(uint256 => AccessPermission))) private permissions;

    /// @notice Emergency contact configured by each patient.
    mapping(address => address) public emergencyContacts;

    /// @notice SHA-256 document/data anchors: patient => scopeId => plaintext hash.
    mapping(address => mapping(uint256 => bytes32)) public dataHashes;

    /// @notice Emitted when the super admin registers a provider on-chain.
    event ProviderRegistered(address indexed provider, string name);

    /// @notice Emitted when the super admin removes provider registration.
    event ProviderRemoved(address indexed provider);

    /// @notice Emitted when the super admin creates a new health data scope.
    event ScopeAdded(uint256 indexed scopeId, string name);

    /// @notice Emitted when a patient grants provider access to one scope.
    event AccessGranted(address indexed patient, address indexed provider, uint256 indexed scopeId, uint256 expiryTime);

    /// @notice Emitted when a patient revokes provider access to one scope.
    event AccessRevoked(address indexed patient, address indexed provider, uint256 indexed scopeId);

    /// @notice Emitted when a registered provider successfully accesses an approved record scope.
    event RecordAccessed(address indexed patient, address indexed provider, uint256 indexed scopeId, uint256 timestamp);

    /// @notice Emitted before reverting when a provider tries to access a scope without valid permission.
    event AccessDenied(address indexed patient, address indexed provider, uint256 indexed scopeId, string reason);

    /// @notice Emitted when a patient sets or changes their emergency contact.
    event EmergencyContactSet(address indexed patient, address indexed emergencyContact);

    /// @notice Emitted when the patient's emergency contact uses emergency access.
    event EmergencyAccessUsed(address indexed patient, address indexed emergencyContact, uint256 indexed scopeId);

    /// @notice Emitted when a patient anchors a plaintext data hash for a scope.
    event DataHashRegistered(address indexed patient, uint256 indexed scopeId, bytes32 dataHash);

    /// @dev Restricts sensitive operations to the deployer/super admin.
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only Super Admin can do this");
        _;
    }

    /// @dev Ensures the caller is a provider registered by the super admin.
    modifier onlyRegisteredProvider() {
        require(providers[msg.sender].isRegistered, "Caller is not a registered provider");
        _;
    }

    /// @dev Ensures the scope exists before reading or writing scope-specific state.
    modifier validScope(uint256 _scopeId) {
        require(_scopeId >= 1 && _scopeId <= scopeCount, "Invalid scope ID");
        _;
    }

    /// @notice Sets the deployer as super admin and creates the default sensitive health scopes.
    constructor() {
        admin = msg.sender;
        _addScope("HIV Status");
        _addScope("Mental Health Records");
        _addScope("Gender Identity");
        _addScope("General Medical History");
        _addScope("Prescription Records");
    }

    /// @notice Register a verified healthcare provider on-chain.
    /// @dev Backend approval is separate; this function is the blockchain-side provider registration.
    /// @param _provider Provider wallet address.
    /// @param _name Human-readable provider or hospital name.
    function registerProvider(address _provider, string calldata _name) external onlyAdmin {
        require(_provider != address(0), "Invalid");
        require(!providers[_provider].isRegistered, "Already registered");

        providers[_provider] = Provider(true, _name);
        emit ProviderRegistered(_provider, _name);
    }

    /// @notice Remove a provider from the on-chain registry.
    /// @param _provider Provider wallet address to remove.
    function removeProvider(address _provider) external onlyAdmin {
        require(providers[_provider].isRegistered, "Not registered");

        providers[_provider].isRegistered = false;
        emit ProviderRemoved(_provider);
    }

    /// @notice Add a new health data scope.
    /// @param _name Human-readable scope name.
    function addScope(string calldata _name) external onlyAdmin {
        _addScope(_name);
    }

    /// @dev Internal scope creation helper used by the constructor and addScope.
    function _addScope(string memory _name) internal {
        scopeCount++;
        scopes[scopeCount] = _name;
        emit ScopeAdded(scopeCount, _name);
    }

    /// @notice Grant a registered provider time-limited access to one scope.
    /// @param _provider Provider wallet address receiving access.
    /// @param _scopeId Health data scope ID.
    /// @param _durationSecs Access duration in seconds.
    function grantAccess(address _provider, uint256 _scopeId, uint256 _durationSecs) external validScope(_scopeId) {
        require(providers[_provider].isRegistered, "Provider not registered");
        require(_provider != msg.sender, "Cannot grant to self");
        require(_durationSecs > 0, "Duration must be > 0");

        uint256 expiry = block.timestamp + _durationSecs;
        permissions[msg.sender][_provider][_scopeId] = AccessPermission(true, expiry, block.timestamp);
        emit AccessGranted(msg.sender, _provider, _scopeId, expiry);
    }

    /// @notice Grant a registered provider time-limited access to multiple scopes.
    /// @param _provider Provider wallet address receiving access.
    /// @param _scopeIds Health data scope IDs.
    /// @param _durationSecs Access duration in seconds.
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

    /// @notice Revoke one provider's access to one scope.
    /// @param _provider Provider wallet address losing access.
    /// @param _scopeId Health data scope ID.
    function revokeAccess(address _provider, uint256 _scopeId) external validScope(_scopeId) {
        permissions[msg.sender][_provider][_scopeId].granted = false;
        emit AccessRevoked(msg.sender, _provider, _scopeId);
    }

    /// @notice Revoke all currently granted scopes for one provider.
    /// @param _provider Provider wallet address losing access.
    function revokeAllAccess(address _provider) external {
        for (uint256 i = 1; i <= scopeCount; i++) {
            if (permissions[msg.sender][_provider][i].granted) {
                permissions[msg.sender][_provider][i].granted = false;
                emit AccessRevoked(msg.sender, _provider, i);
            }
        }
    }

    /// @notice Set an emergency contact that can use emergency access.
    /// @param _contact Emergency contact wallet address.
    function setEmergencyContact(address _contact) external {
        require(_contact != address(0), "Invalid");
        require(_contact != msg.sender, "Cannot be own contact");

        emergencyContacts[msg.sender] = _contact;
        emit EmergencyContactSet(msg.sender, _contact);
    }

    /// @notice Anchor the SHA-256 plaintext hash for a patient's scope data.
    /// @dev This stores only the hash, not the medical data.
    /// @param _scopeId Health data scope ID.
    /// @param _hash SHA-256 hash of the plaintext data or document.
    function registerDataHash(uint256 _scopeId, bytes32 _hash) external validScope(_scopeId) {
        dataHashes[msg.sender][_scopeId] = _hash;
        emit DataHashRegistered(msg.sender, _scopeId, _hash);
    }

    /// @notice Check whether the caller has active, unexpired access to a patient's scope.
    /// @param _patient Patient wallet address.
    /// @param _scopeId Health data scope ID.
    /// @return True when access is granted and not expired.
    function checkAccess(address _patient, uint256 _scopeId) public view validScope(_scopeId) returns (bool) {
        AccessPermission memory p = permissions[_patient][msg.sender][_scopeId];
        if (!p.granted) return false;
        if (p.expiryTime != 0 && block.timestamp > p.expiryTime) return false;
        return true;
    }

    /// @notice Record a provider access event after confirming permission.
    /// @dev The returned string is only a signal; the real data remains off-chain in the backend.
    /// @param _patient Patient wallet address.
    /// @param _scopeId Health data scope ID.
    /// @return Confirmation message.
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

    /// @notice Record emergency access for a patient's designated emergency contact.
    /// @param _patient Patient wallet address.
    /// @param _scopeId Health data scope ID.
    /// @return Confirmation message.
    function emergencyAccessRecord(address _patient, uint256 _scopeId) external validScope(_scopeId) returns (string memory) {
        require(emergencyContacts[_patient] == msg.sender, "Not emergency contact");

        emit EmergencyAccessUsed(_patient, msg.sender, _scopeId);
        return "Emergency access granted";
    }

    /// @notice Read full permission details for a patient/provider/scope tuple.
    /// @param _patient Patient wallet address.
    /// @param _provider Provider wallet address.
    /// @param _scopeId Health data scope ID.
    /// @return granted Whether access is currently granted.
    /// @return expiryTime Unix timestamp when access expires.
    /// @return grantedAt Unix timestamp when access was granted.
    function getPermission(address _patient, address _provider, uint256 _scopeId)
        external
        view
        returns (bool granted, uint256 expiryTime, uint256 grantedAt)
    {
        AccessPermission memory p = permissions[_patient][_provider][_scopeId];
        return (p.granted, p.expiryTime, p.grantedAt);
    }

    /// @notice Verify that a supplied plaintext hash matches the hash anchored for a patient's scope.
    /// @param _patient Patient wallet address.
    /// @param _scopeId Health data scope ID.
    /// @param _hash SHA-256 plaintext hash to verify.
    /// @return True when the supplied hash matches the stored hash.
    function verifyDataHash(address _patient, uint256 _scopeId, bytes32 _hash)
        external
        view
        validScope(_scopeId)
        returns (bool)
    {
        return dataHashes[_patient][_scopeId] == _hash;
    }
}
