import express, { Request, Response } from 'express';
import { PrismaClient, Contact } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.post('/identify', async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;
  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'At least one of email or phoneNumber is required.' });
  }

  // 1. Find all contacts matching email or phoneNumber
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        email ? { email } : undefined,
        phoneNumber ? { phoneNumber } : undefined,
      ].filter(Boolean) as any[],
    },
    orderBy: { createdAt: 'asc' },
  });

  // 2. If no contacts found, create a new primary contact
  if (contacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'primary',
      },
    });
    return res.status(200).json({
      contact: {
        primaryContatctId: newContact.id,
        emails: [newContact.email].filter(Boolean),
        phoneNumbers: [newContact.phoneNumber].filter(Boolean),
        secondaryContactIds: [],
      },
    });
  }

  // 3. Find all related contacts (by traversing linkedId and id)
  //    - Get all contacts that are part of the same identity group
  //    - This includes: all contacts with id or linkedId in the set
  let allContactIds = new Set<number>(contacts.map(c => c.id));
  let allLinkedIds = new Set<number>(contacts.filter(c => c.linkedId).map(c => c.linkedId!));
  let groupIds = new Set<number>([...allContactIds, ...allLinkedIds]);

  // Find all contacts in this group
  let groupContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { id: { in: Array.from(groupIds) } },
        { linkedId: { in: Array.from(groupIds) } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  // 4. Determine the primary contact (oldest by createdAt)
  let primaryContact = groupContacts.find(c => c.linkPrecedence === 'primary') || groupContacts[0];
  for (const c of groupContacts) {
    if (c.createdAt < primaryContact.createdAt) {
      primaryContact = c;
    }
  }

  // 5. If there are multiple primaries, update newer ones to secondary
  const primaries = groupContacts.filter(c => c.linkPrecedence === 'primary');
  for (const c of primaries) {
    if (c.id !== primaryContact.id) {
      await prisma.contact.update({
        where: { id: c.id },
        data: {
          linkPrecedence: 'secondary',
          linkedId: primaryContact.id,
        },
      });
    }
  }

  // 6. If the incoming data has new info, create a secondary contact
  const emails = groupContacts.map(c => c.email).filter(Boolean);
  const phoneNumbers = groupContacts.map(c => c.phoneNumber).filter(Boolean);
  let newContact: Contact | null = null;
  const hasEmail = email && emails.includes(email);
  const hasPhone = phoneNumber && phoneNumbers.includes(phoneNumber);
  if (!hasEmail || !hasPhone) {
    // Only create if at least one of the fields is new
    if ((email && !hasEmail) || (phoneNumber && !hasPhone)) {
      newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: 'secondary',
          linkedId: primaryContact.id,
        },
      });
      groupContacts.push(newContact);
    }
  }

  // 7. Prepare response
  //    - emails: unique, primary first
  //    - phoneNumbers: unique, primary first
  //    - secondaryContactIds: all secondary contacts
  const uniqueEmails = Array.from(new Set([
    primaryContact.email,
    ...groupContacts.filter(c => c.id !== primaryContact.id).map(c => c.email),
  ].filter(Boolean)));
  const uniquePhones = Array.from(new Set([
    primaryContact.phoneNumber,
    ...groupContacts.filter(c => c.id !== primaryContact.id).map(c => c.phoneNumber),
  ].filter(Boolean)));
  const secondaryContactIds = groupContacts
    .filter(c => c.linkPrecedence === 'secondary' && c.linkedId === primaryContact.id)
    .map(c => c.id);

  return res.status(200).json({
    contact: {
      primaryContatctId: primaryContact.id,
      emails: uniqueEmails,
      phoneNumbers: uniquePhones,
      secondaryContactIds,
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 