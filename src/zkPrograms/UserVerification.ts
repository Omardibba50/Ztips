import {
  ZkProgram,
  PublicKey,
  Field,
  Struct,
  Poseidon,
  CircuitString,
} from 'o1js';

class UserData extends Struct({
  publicKey: PublicKey,
  name: CircuitString,
  email: CircuitString,
}) {}

export const UserVerification = ZkProgram({
  name: 'user-verification',
  publicInput: UserData,
  publicOutput: Field,

  methods: {
    verifyUser: {
      privateInputs: [],

      async method(userData: UserData): Promise<Field> {
        // Convert CircuitString to Field array
        const nameFields = Poseidon.hash(CircuitString.toFields(userData.name));
        const emailFields = Poseidon.hash(CircuitString.toFields(userData.email));

        // Create a hash of user data
        const verificationHash = Poseidon.hash(
          userData.publicKey.toFields().concat(nameFields).concat(emailFields)
        );

        return verificationHash;
      },
    },
  },
});

export class UserVerificationProof extends ZkProgram.Proof(UserVerification) {}