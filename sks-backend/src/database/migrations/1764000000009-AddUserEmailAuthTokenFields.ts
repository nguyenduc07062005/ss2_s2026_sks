import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserEmailAuthTokenFields1764000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'is_email_verified',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'email_verified_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'email_verification_token_hash',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'email_verification_token_expires_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'reset_password_token_hash',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'reset_password_token_expires_at',
        type: 'timestamp',
        isNullable: true,
      }),
    ]);

    await queryRunner.query(`
      UPDATE users
      SET is_email_verified = true,
          email_verified_at = COALESCE(email_verified_at, NOW())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'reset_password_token_expires_at');
    await queryRunner.dropColumn('users', 'reset_password_token_hash');
    await queryRunner.dropColumn(
      'users',
      'email_verification_token_expires_at',
    );
    await queryRunner.dropColumn('users', 'email_verification_token_hash');
    await queryRunner.dropColumn('users', 'email_verified_at');
    await queryRunner.dropColumn('users', 'is_email_verified');
  }
}
