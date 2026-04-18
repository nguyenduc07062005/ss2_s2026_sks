import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserDocumentExtraAttributes1764000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const userDocumentsTable = await queryRunner.getTable('user_documents');
    const hasExtraAttributesColumn =
      userDocumentsTable?.findColumnByName('extra_attributes') != null;

    if (!hasExtraAttributesColumn) {
      await queryRunner.addColumn(
        'user_documents',
        new TableColumn({
          name: 'extra_attributes',
          type: 'jsonb',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const userDocumentsTable = await queryRunner.getTable('user_documents');
    const hasExtraAttributesColumn =
      userDocumentsTable?.findColumnByName('extra_attributes') != null;

    if (hasExtraAttributesColumn) {
      await queryRunner.dropColumn('user_documents', 'extra_attributes');
    }
  }
}
