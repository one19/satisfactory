import * as aws from '@pulumi/aws';

// Get the latest Amazon Linux 2 AMI
const ami = aws.ec2.getAmi({
  owners: ['amazon'],
  filters: [{ name: 'name', values: ['amzn2-ami-hvm-2.0.*-x86_64-gp2'] }],
  mostRecent: true,
});

// Create a security group to allow port 7777 TCP and UDP
const securityGroup = new aws.ec2.SecurityGroup('satisfactory-sg', {
  description: 'Allow port 7777 TCP and UDP',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 7777,
      toPort: 7777,
      cidrBlocks: ['0.0.0.0/0'],
    },
    {
      protocol: 'udp',
      fromPort: 7777,
      toPort: 7777,
      cidrBlocks: ['0.0.0.0/0'],
    },
  ],
  egress: [
    {
      protocol: '-1', // Allow all outbound traffic
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ['0.0.0.0/0'],
    },
  ],
});

// Define the availability zone
const availabilityZone = 'ap-southeast-2'; // Adjust as needed

// Create a high-speed EBS volume
const ebsVolume = new aws.ebs.Volume('satisfactory-volume', {
  availabilityZone,
  size: 100, // Size in GB
  type: 'gp3', // High-performance volume type
});

// Define the user data script for instance initialization
const userDataScript = `#!/bin/bash
# Update packages
yum update -y

# Install Docker
amazon-linux-extras install docker -y
service docker start
usermod -a -G docker ec2-user

# Wait for the volume to be attached
while [ ! -e /dev/xvdf ]; do sleep 1; done

# Format and mount the volume
mkfs -t ext4 /dev/xvdf
mkdir /config
mount /dev/xvdf /config
echo "/dev/xvdf /config ext4 defaults,nofail 0 2" >> /etc/fstab

# Run the Docker container with /config mounted
docker run -d -v /config:/config -p 7777:7777/tcp -p 7777:7777/udp wolveix/satisfactory-server:latest
`;

// Create the EC2 instance
const ec2Instance = new aws.ec2.Instance('satisfactory-instance', {
  ami: ami.then((a) => a.id),
  instanceType: 'm5.xlarge', // Updated instance type
  availabilityZone,
  securityGroups: [securityGroup.name],
  userData: userDataScript,
});

// Attach the EBS volume to the instance
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
const volumeAttachment = new aws.ec2.VolumeAttachment(
  'volume-attachment',
  {
    deviceName: '/dev/sdf',
    instanceId: ec2Instance.id,
    volumeId: ebsVolume.id,
  },
  { dependsOn: [ec2Instance] }
);

// Allocate an Elastic IP and associate it with the instance
const elasticIp = new aws.ec2.Eip('satisfactory-eip', {
  instance: ec2Instance.id,
});

// Export the public IP address of the instance
// eslint-disable-next-line import/prefer-default-export
export const { publicIp } = elasticIp;
